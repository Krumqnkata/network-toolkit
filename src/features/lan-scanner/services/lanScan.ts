import {
  assembleMdns,
  escapeLabel,
  parseUpnpDescription,
  serviceTypesFrom,
  type LanDevice,
  type MdnsService,
  type UpnpInfo,
} from '../../../domain/algorithms/devices';
import { ensureLocalNetwork } from '../../../services/permissions/localNetworkPermission';
import { DNS_RECORD_TYPES } from '../../../domain/algorithms/dns';
import { isIPv4, reverseDnsName } from '../../../domain/algorithms/ip';
import { chunk, DISCOVERY_PORTS } from '../../../domain/algorithms/ports';
import { compareIpv4, scanRange } from '../../../domain/algorithms/subnet';
import { parseHostPort } from '../../../domain/algorithms/web';
import type { NetworkSnapshot } from '../../../domain/models/network';
import {
  mdnsQuery,
  netbiosQuery,
  probeHosts,
  ssdpSearch,
  type HostProbe,
  type MdnsReply,
  type SsdpReply,
} from '../../../native/lan';
import { getNetworkSnapshot } from '../../../native/network';
import { dnsQuery } from '../../../native/netTools';
import { isLanScanning, useLanStore } from '../../../stores/lanStore';
import { identifyDevice } from './identify';
import { AppError, logError, toAppError } from '../../../utils/errors';

/** 32 hosts × 8 ports = 256 connects per native call. */
export const PROBE_BATCH = 32;
export const PROBE_TIMEOUT_MS = 700;
/** Devices identified at the same time. */
export const IDENTIFY_PARALLELISM = 6;
const MDNS_ROUND_MS = 1500;
const SSDP_MS = 2500;

/** Service types queried even if a device does not list them in `_services._dns-sd`. */
export const DEFAULT_MDNS_TYPES = [
  '_googlecast._tcp.local',
  '_airplay._tcp.local',
  '_raop._tcp.local',
  '_ipp._tcp.local',
  '_printer._tcp.local',
  '_smb._tcp.local',
  '_workstation._tcp.local',
  '_device-info._tcp.local',
  '_companion-link._tcp.local',
  '_hap._tcp.local',
  '_spotify-connect._tcp.local',
  '_http._tcp.local',
];

export interface ScanTarget {
  localAddress: string;
  prefixLength: number;
  gateway: string | null;
}

/** The IPv4 address of the active Wi-Fi or Ethernet network, or an explanatory error. */
export function scanTargetFrom(snapshot: NetworkSnapshot): ScanTarget {
  if (snapshot.transport !== 'wifi' && snapshot.transport !== 'ethernet') {
    throw new AppError(
      'unsupported',
      snapshot.isVpn
        ? 'The active network is a VPN. Turn it off to scan your local network.'
        : 'Connect to Wi-Fi or Ethernet to scan the local network.',
    );
  }
  const ipv4 = snapshot.addresses.find(
    address => address.family === 'ipv4' && !address.address.startsWith('169.254.'),
  );
  if (!ipv4) throw new AppError('unsupported', 'The active network has no IPv4 address.');
  return {
    localAddress: ipv4.address,
    prefixLength: ipv4.prefixLength,
    gateway: snapshot.gateways.find(isIPv4) ?? null,
  };
}

async function discoverMdns(localAddress: string): Promise<Map<string, MdnsService[]>> {
  try {
    const enumeration = await mdnsQuery(
      localAddress,
      [{ name: '_services._dns-sd._udp.local', type: DNS_RECORD_TYPES.PTR }],
      MDNS_ROUND_MS,
    );
    const types = [...new Set([...DEFAULT_MDNS_TYPES, ...serviceTypesFrom(enumeration)])];
    const replies: MdnsReply[] = await mdnsQuery(
      localAddress,
      types.map(name => ({ name, type: DNS_RECORD_TYPES.PTR })),
      MDNS_ROUND_MS,
    );
    // Instances whose SRV/TXT/A were not included get one follow-up query.
    const assembled = assembleMdns(replies);
    const incomplete = [...assembled.values()]
      .flat()
      .filter(service => service.port === null)
      .slice(0, 24);
    if (incomplete.length > 0) {
      const followUp = await mdnsQuery(
        localAddress,
        incomplete.flatMap(service => {
          const name = `${escapeLabel(service.instance)}.${service.type}.local`;
          return [
            { name, type: DNS_RECORD_TYPES.SRV },
            { name, type: DNS_RECORD_TYPES.TXT },
          ];
        }),
        MDNS_ROUND_MS,
      );
      return assembleMdns([...replies, ...followUp]);
    }
    return assembled;
  } catch (error) {
    logError('lan-mdns', error);
    return new Map();
  }
}

async function discoverSsdp(localAddress: string): Promise<SsdpReply[]> {
  try {
    return await ssdpSearch(localAddress, SSDP_MS);
  } catch (error) {
    logError('lan-ssdp', error);
    return [];
  }
}

/** Fetches UPnP descriptions, only from the address that announced them. */
async function describeUpnp(replies: SsdpReply[]): Promise<Map<string, UpnpInfo>> {
  const byAddress = new Map<string, UpnpInfo>();
  const seen = new Set<string>();
  await Promise.all(
    replies.map(async reply => {
      if (!reply.location || seen.has(reply.location)) return;
      seen.add(reply.location);
      // Never follow a description URL to another host than the one that answered.
      const target = reply.location.startsWith('http://') ? parseHostPort(reply.location) : null;
      if (!target || target.host !== reply.from) return;
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2500);
      try {
        const response = await fetch(reply.location, { signal: controller.signal });
        if (!response.ok) return;
        const info = parseUpnpDescription(await response.text(), reply.server);
        const current = byAddress.get(reply.from);
        // Prefer the description that has a friendly name (root devices usually do).
        if (!current || (!current.friendlyName && info.friendlyName))
          byAddress.set(reply.from, info);
      } catch (error) {
        logError('lan-upnp', error);
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  for (const reply of replies) {
    if (!byAddress.has(reply.from) && reply.server) {
      byAddress.set(reply.from, {
        friendlyName: null,
        manufacturer: null,
        modelName: null,
        deviceType: null,
        server: reply.server,
      });
    }
  }
  return byAddress;
}

async function reverseLookup(address: string): Promise<string | null> {
  const name = reverseDnsName(address);
  if (!name) return null;
  try {
    const result = await dnsQuery(name, DNS_RECORD_TYPES.PTR, null, 2500);
    return result.answers.find(answer => answer.type === DNS_RECORD_TYPES.PTR)?.data ?? null;
  } catch {
    return null;
  }
}

async function mapLimited<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index] as T);
    }
  });
  await Promise.all(workers);
  return results;
}

function emptyDevice(address: string, source: LanDevice['source']): LanDevice {
  return {
    address,
    isSelf: false,
    isGateway: false,
    source,
    rttMs: null,
    openPorts: [],
    hostname: null,
    mdnsHost: null,
    services: [],
    netbiosName: null,
    workgroup: null,
    mac: null,
    upnp: null,
    fingerprint: null,
  };
}

export function cancelLanScan(): void {
  const { runId, phase, update } = useLanStore.getState();
  if (isLanScanning(phase)) {
    update({ runId: runId + 1, phase: 'done' });
  }
}

/**
 * Full LAN scan: TCP/ICMP sweep of the subnet in batches, mDNS and SSDP in
 * parallel, then names (reverse DNS, NetBIOS) and UPnP descriptions for every
 * device found. Results and progress are written to `useLanStore`.
 */
export async function startLanScan(): Promise<void> {
  const store = useLanStore.getState();
  const runId = store.runId + 1;
  const active = () => useLanStore.getState().runId === runId;
  const update = store.update;
  update({ runId, phase: 'probing', progress: 0, devices: [], error: null });

  try {
    await ensureLocalNetwork();
    const target = scanTargetFrom(await getNetworkSnapshot());
    const range = scanRange(target.localAddress, target.prefixLength);
    if (!range) throw new AppError('unsupported', 'This network is too small to scan.');
    const startedAt = Date.now();
    update({
      info: {
        cidr: range.cidr,
        truncated: range.truncated,
        localAddress: target.localAddress,
        gateway: target.gateway,
        startedAt,
        finishedAt: null,
      },
    });

    const mdnsPromise = discoverMdns(target.localAddress);
    const ssdpPromise = discoverSsdp(target.localAddress);

    const devices = new Map<string, LanDevice>();
    const self = emptyDevice(target.localAddress, 'self');
    self.isSelf = true;
    devices.set(self.address, self);
    const publish = () =>
      update({
        devices: [...devices.values()]
          .map(device => ({ ...device }))
          .sort((a, b) => compareIpv4(a.address, b.address)),
      });

    const others = range.hosts.filter(host => host !== target.localAddress);
    const batches = chunk(others, PROBE_BATCH);
    for (const [index, batch] of batches.entries()) {
      const probes: HostProbe[] = await probeHosts(
        batch,
        [...DISCOVERY_PORTS],
        PROBE_TIMEOUT_MS,
        true,
      );
      if (!active()) return;
      for (const probe of probes) {
        if (!probe.alive) continue;
        const device = emptyDevice(probe.address, probe.method ?? 'tcp');
        device.rttMs = probe.rttMs;
        device.openPorts = probe.openPorts;
        devices.set(probe.address, device);
      }
      publish();
      update({ progress: ((index + 1) / batches.length) * 0.8 });
    }

    update({ phase: 'naming' });
    const [mdns, ssdp] = await Promise.all([mdnsPromise, ssdpPromise]);
    if (!active()) return;
    for (const [address, services] of mdns) {
      if (!isIPv4(address)) continue;
      const device = devices.get(address) ?? emptyDevice(address, 'mdns');
      device.services = services;
      device.mdnsHost = services.find(service => service.host)?.host ?? null;
      devices.set(address, device);
    }
    for (const reply of ssdp) {
      if (isIPv4(reply.from) && !devices.has(reply.from)) {
        devices.set(reply.from, emptyDevice(reply.from, 'ssdp'));
      }
    }
    if (target.gateway) {
      const gateway = devices.get(target.gateway) ?? emptyDevice(target.gateway, 'tcp');
      gateway.isGateway = true;
      devices.set(target.gateway, gateway);
    }
    publish();
    update({ progress: 0.85 });

    const addresses = [...devices.keys()];
    const [names, netbios, upnp] = await Promise.all([
      mapLimited(addresses, 8, reverseLookup),
      netbiosQuery(addresses.slice(0, 256)).catch(error => {
        logError('lan-netbios', error);
        return [];
      }),
      describeUpnp(ssdp),
    ]);
    if (!active()) return;
    addresses.forEach((address, index) => {
      const device = devices.get(address);
      if (device) device.hostname = names[index] ?? null;
    });
    for (const info of netbios) {
      const device = devices.get(info.address);
      if (!device) continue;
      device.netbiosName = info.name;
      device.workgroup = info.workgroup;
      device.mac = info.mac;
    }
    for (const [address, info] of upnp) {
      const device = devices.get(address);
      if (device) device.upnp = info;
    }
    publish();

    // Ask each device about itself: ping TTL, web/SSH banners, certificate, MAC vendor.
    update({ phase: 'identifying', progress: 0.9 });
    const targets = [...devices.values()].filter(device => !device.isSelf);
    let identified = 0;
    await mapLimited(targets, IDENTIFY_PARALLELISM, async device => {
      const fingerprint = await identifyDevice(device);
      if (!active()) return;
      device.fingerprint = fingerprint;
      identified++;
      update({ progress: 0.9 + (identified / Math.max(1, targets.length)) * 0.1 });
    });
    if (!active()) return;
    publish();
    const info = useLanStore.getState().info;
    update({
      phase: 'done',
      progress: 1,
      info: info ? { ...info, finishedAt: Date.now() } : info,
    });
  } catch (error) {
    logError('lan-scan', error);
    if (active()) update({ phase: 'done', error: toAppError(error) });
  }
}
