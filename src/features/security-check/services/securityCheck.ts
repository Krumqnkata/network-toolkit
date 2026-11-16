import { displayName, guessKind } from '../../../domain/algorithms/devices';
import { isIPv4 } from '../../../domain/algorithms/ip';
import { chunk } from '../../../domain/algorithms/ports';
import {
  DEVICE_PORTS,
  ROUTER_PORTS,
  evaluateSecurity,
  type PortState,
  type SecurityInput,
  type SecurityReport,
} from '../../../domain/algorithms/security';
import {
  findWanService,
  parsePortMapping,
  portMappingRequest,
  splitUrl,
  type PortMapping,
} from '../../../domain/algorithms/upnpIgd';
import { probeHosts, readBanner, scanPorts, ssdpSearch } from '../../../native/lan';
import { getNetworkSnapshot } from '../../../native/network';
import { getCachedWifiScan } from '../../../native/wifi';
import { ensureLocalNetwork } from '../../../services/permissions/localNetworkPermission';
import { useLanStore } from '../../../stores/lanStore';
import { AppError, logError } from '../../../utils/errors';

/** Port forwards read at most; a home router rarely has more than a handful. */
export const MAX_MAPPINGS = 32;

export interface SecurityCheckResult extends SecurityReport {
  createdAt: number;
  ssid: string | null;
  gateway: string | null;
  /** True when the device checks used a LAN scan from this session. */
  devicesScanned: boolean;
}

/** UPnP gateway on the router and the port forwards it lists. */
async function readUpnp(localAddress: string, gateway: string): Promise<SecurityInput['upnp']> {
  let replies;
  try {
    replies = await ssdpSearch(localAddress, 2500);
  } catch (error) {
    logError('security-upnp', error);
    return null;
  }
  const fromRouter = replies.filter(reply => reply.from === gateway && reply.location);
  if (!fromRouter.length) return { found: false, mappings: [] };
  const isGateway = fromRouter.some(reply =>
    /InternetGatewayDevice|WAN(IP|PPP)Connection/i.test(`${reply.st ?? ''} ${reply.usn ?? ''}`),
  );

  for (const location of new Set(fromRouter.map(reply => reply.location!))) {
    // Only descriptions served by the router itself, over plain HTTP.
    const target = splitUrl(location);
    if (!target || target.host !== gateway) continue;
    let xml: string;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await fetch(location, { signal: controller.signal });
      if (!response.ok) continue;
      xml = await response.text();
    } catch (error) {
      logError('security-upnp', error);
      continue;
    } finally {
      clearTimeout(timer);
    }
    const service = findWanService(xml, location);
    if (!service) continue;
    const control = splitUrl(service.controlUrl);
    if (!control || control.host !== gateway) return { found: true, mappings: null };
    const mappings: PortMapping[] = [];
    try {
      for (let index = 0; index < MAX_MAPPINGS; index++) {
        const reply = await readBanner(gateway, control.port, portMappingRequest(service, index), {
          maxBytes: 8192,
          timeoutMs: 2500,
        });
        const mapping = parsePortMapping(reply.text);
        if (!mapping) break;
        mappings.push(mapping);
      }
    } catch (error) {
      logError('security-upnp', error);
      if (!mappings.length) return { found: true, mappings: null };
    }
    return { found: true, mappings };
  }
  return isGateway ? { found: true, mappings: null } : { found: false, mappings: [] };
}

/** Risky ports on the devices found by the last LAN scan. */
async function checkDevices(gateway: string | null): Promise<SecurityInput['devices']> {
  const lan = useLanStore
    .getState()
    .devices.filter(device => !device.isSelf && !device.isGateway && device.address !== gateway);
  if (!lan.length) return null;
  const open = new Map<string, number[]>();
  for (const batch of chunk(
    lan.map(device => device.address),
    Math.floor(512 / DEVICE_PORTS.length),
  )) {
    const probes = await probeHosts(batch, [...DEVICE_PORTS], 800, false);
    for (const probe of probes) open.set(probe.address, probe.openPorts);
  }
  return lan.map(device => ({
    name: displayName(device) ?? guessKind(device),
    address: device.address,
    openPorts: open.get(device.address) ?? [],
  }));
}

/**
 * Looks at the Wi-Fi security, the router (open services, UPnP and its port
 * forwards) and the devices from the last LAN scan. Everything is read-only:
 * nothing is logged into, changed or removed.
 */
export async function runSecurityCheck(): Promise<SecurityCheckResult> {
  const snapshot = await getNetworkSnapshot();
  if (snapshot.transport !== 'wifi' && snapshot.transport !== 'ethernet') {
    throw new AppError('unsupported', 'not-local');
  }
  await ensureLocalNetwork();
  const gateway = snapshot.gateways.find(isIPv4) ?? null;
  const localAddress =
    snapshot.addresses.find(address => address.family === 'ipv4')?.address ?? null;

  let capabilities: string | null = null;
  let wps: boolean | null = null;
  if (snapshot.wifi) {
    try {
      const scan = await getCachedWifiScan();
      const bssid = snapshot.wifi.bssid?.toLowerCase() ?? null;
      const ssid = snapshot.wifi.ssid;
      const connected = bssid
        ? scan.networks.find(network => network.bssid?.toLowerCase() === bssid)
        : undefined;
      capabilities = connected?.capabilities ?? null;
      // WPS on any access point of this network counts.
      const own = scan.networks.filter(network => ssid && network.ssid === ssid);
      wps = own.length
        ? own.some(network => network.capabilities.toUpperCase().includes('[WPS]'))
        : null;
    } catch (error) {
      logError('security', error);
    }
  }

  let routerPorts: Record<number, PortState> | null = null;
  if (gateway) {
    try {
      const result = await scanPorts(gateway, [...ROUTER_PORTS], 1500);
      routerPorts = Object.fromEntries(
        result.ports.map(port => [port.port, port.status === 'open' ? 'open' : 'closed']),
      ) as Record<number, PortState>;
    } catch (error) {
      logError('security', error);
    }
  }

  const [upnp, devices] = await Promise.all([
    gateway && localAddress ? readUpnp(localAddress, gateway) : Promise.resolve(null),
    checkDevices(gateway).catch(error => {
      logError('security', error);
      return null;
    }),
  ]);

  const report = evaluateSecurity({
    wifi: snapshot.wifi ? { security: snapshot.wifi.security, capabilities } : null,
    wps,
    routerPorts,
    upnp,
    devices,
    privateDns: snapshot.privateDnsActive === true,
  });
  return {
    ...report,
    createdAt: Date.now(),
    ssid: snapshot.wifi?.ssid ?? null,
    gateway,
    devicesScanned: devices !== null,
  };
}
