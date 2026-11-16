import { DNS_RECORD_TYPES } from './dns';
import { identify, type Fingerprint } from './fingerprint';

export type DeviceKind =
  | 'router'
  | 'phone'
  | 'computer'
  | 'printer'
  | 'tv'
  | 'speaker'
  | 'nas'
  | 'camera'
  | 'iot'
  | 'unknown';

export interface MdnsService {
  /** Service type, e.g. `_ipp._tcp`. */
  type: string;
  /** Instance name, e.g. `Office Printer`. */
  instance: string;
  /** SRV target host, e.g. `printer.local`. */
  host: string | null;
  port: number | null;
  txt: Record<string, string>;
}

export interface UpnpInfo {
  friendlyName: string | null;
  manufacturer: string | null;
  modelName: string | null;
  deviceType: string | null;
  server: string | null;
}

export interface LanDevice {
  address: string;
  isSelf: boolean;
  isGateway: boolean;
  /** How the device was found first. */
  source: 'tcp' | 'icmp' | 'mdns' | 'ssdp' | 'self';
  rttMs: number | null;
  openPorts: number[];
  /** Reverse DNS (PTR), usually provided by the router's DHCP server. */
  hostname: string | null;
  mdnsHost: string | null;
  services: MdnsService[];
  netbiosName: string | null;
  workgroup: string | null;
  mac: string | null;
  upnp: UpnpInfo | null;
  /** TTL, HTTP/SSH/TLS banners and MAC vendor; null until identified. */
  fingerprint: Fingerprint | null;
}

export interface MdnsRecordLike {
  name: string;
  type: number;
  data: string;
}

/** `"a=1" "b=2"` → `{ a: '1', b: '2' }` (RFC 6763 §6 key/value TXT strings). */
export function parseTxtAttributes(data: string): Record<string, string> {
  const result: Record<string, string> = {};
  const strings = data.match(/"((?:[^"\\]|\\.)*)"/g) ?? [];
  for (const quoted of strings) {
    const value = quoted.slice(1, -1).replace(/\\(.)/g, '$1');
    const index = value.indexOf('=');
    if (index > 0) result[value.slice(0, index).toLowerCase()] = value.slice(index + 1);
    else if (value !== '') result[value.toLowerCase()] = '';
  }
  return result;
}

/** Removes the presentation-format escape of dots inside a DNS label (`My\.Box` → `My.Box`). */
export function unescapeLabel(label: string): string {
  return label.replace(/\\(.)/g, '$1');
}

/** Escapes a label for presentation format: backslashes first, then dots (`My.Box` → `My\.Box`). */
export function escapeLabel(label: string): string {
  return label.replace(/\\/g, '\\\\').replace(/\./g, '\\.');
}

/** Splits `Instance\.Name._ipp._tcp.local` into instance and service type. */
export function splitInstanceName(name: string): { instance: string; type: string } | null {
  const match = name.match(/^(.*?)\.(_[^.]+\._(?:tcp|udp))\.local\.?$/i);
  if (!match || !match[1]) return null;
  return { instance: unescapeLabel(match[1]), type: (match[2] ?? '').toLowerCase() };
}

export interface MdnsReplyLike {
  from: string;
  records: MdnsRecordLike[];
}

/**
 * Turns raw mDNS replies into services per IPv4 address. A service is tied to
 * the address in the A record of its SRV target, or to the replying address
 * when no A record was included.
 */
export function assembleMdns(replies: readonly MdnsReplyLike[]): Map<string, MdnsService[]> {
  const srv = new Map<string, { host: string; port: number }>();
  const txt = new Map<string, Record<string, string>>();
  const hostAddress = new Map<string, string>();
  // Lower-cased full instance name → original name and replying address.
  const instances = new Map<string, { name: string; from: string }>();

  for (const reply of replies) {
    for (const record of reply.records) {
      const key = record.name.toLowerCase();
      if (record.type === DNS_RECORD_TYPES.PTR && splitInstanceName(record.data)) {
        if (!instances.has(record.data.toLowerCase())) {
          instances.set(record.data.toLowerCase(), { name: record.data, from: reply.from });
        }
      } else if (record.type === DNS_RECORD_TYPES.SRV) {
        const [, , port, target] = record.data.split(' ');
        if (port && target) srv.set(key, { host: target.toLowerCase(), port: Number(port) });
        if (!instances.has(key) && splitInstanceName(record.name)) {
          instances.set(key, { name: record.name, from: reply.from });
        }
      } else if (record.type === DNS_RECORD_TYPES.TXT) {
        txt.set(key, parseTxtAttributes(record.data));
      } else if (record.type === DNS_RECORD_TYPES.A) {
        hostAddress.set(key, record.data);
      }
    }
  }

  const byAddress = new Map<string, MdnsService[]>();
  for (const [fullName, { name, from }] of instances) {
    const parts = splitInstanceName(name);
    if (!parts) continue;
    const target = srv.get(fullName);
    const address = (target && hostAddress.get(target.host)) ?? from;
    const service: MdnsService = {
      type: parts.type,
      instance: parts.instance,
      host: target?.host ?? null,
      port: target?.port ?? null,
      txt: txt.get(fullName) ?? {},
    };
    const list = byAddress.get(address) ?? [];
    if (
      !list.some(
        existing => existing.type === service.type && existing.instance === service.instance,
      )
    ) {
      list.push(service);
    }
    byAddress.set(address, list);
  }
  return byAddress;
}

/** Service types announced in replies to `_services._dns-sd._udp.local`. */
export function serviceTypesFrom(replies: readonly MdnsReplyLike[]): string[] {
  const types = new Set<string>();
  for (const reply of replies) {
    for (const record of reply.records) {
      if (
        record.type === DNS_RECORD_TYPES.PTR &&
        record.name.toLowerCase() === '_services._dns-sd._udp.local' &&
        /^_[^.]+\._(tcp|udp)\.local$/i.test(record.data)
      ) {
        types.add(record.data.toLowerCase());
      }
    }
  }
  return [...types];
}

function tag(xml: string, name: string): string | null {
  const match = xml.match(new RegExp(`<${name}>([^<]*)</${name}>`, 'i'));
  const value = match?.[1]?.trim();
  return value ? decodeXml(value) : null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

/** First device's identity from a UPnP device description (UPnP Device Architecture §2.3). */
export function parseUpnpDescription(xml: string, server: string | null): UpnpInfo {
  return {
    friendlyName: tag(xml, 'friendlyName'),
    manufacturer: tag(xml, 'manufacturer'),
    modelName: tag(xml, 'modelName'),
    deviceType: tag(xml, 'deviceType'),
    server,
  };
}

const KIND_BY_SERVICE: [RegExp, DeviceKind][] = [
  [/^_(ipp|ipps|printer|pdl-datastream|scanner|uscan)\._tcp$/, 'printer'],
  [/^_(googlecast|androidtvremote2?|amzn-wplay|viziocast|roku-rcp)\._tcp$/, 'tv'],
  [/^_(raop|spotify-connect|sonos)\._tcp$/, 'speaker'],
  [/^_(airplay)\._tcp$/, 'tv'],
  [/^_(companion-link|apple-mobdev2|rdlink)\._tcp$/, 'phone'],
  [/^_(afpovertls|adisk|nfs|smb)\._tcp$/, 'nas'],
  [/^_(hap|matter|matterc|hue|esphomelib|home-assistant|miio)\._(tcp|udp)$/, 'iot'],
  [/^_(rtsp|onvif)\._tcp$/, 'camera'],
  [/^_(workstation|ssh|sftp-ssh|rfb|device-info)\._tcp$/, 'computer'],
];

/** Best-effort device category from gateway status, services, UPnP type and open ports. */
export function guessKind(device: LanDevice): DeviceKind {
  if (device.isGateway) return 'router';
  for (const [pattern, kind] of KIND_BY_SERVICE) {
    if (device.services.some(service => pattern.test(service.type))) return kind;
  }
  const upnpType = device.upnp?.deviceType?.toLowerCase() ?? '';
  if (upnpType.includes('internetgatewaydevice')) return 'router';
  if (upnpType.includes('mediarenderer')) return 'tv';
  if (upnpType.includes('printer')) return 'printer';
  if (upnpType.includes('mediaserver')) return 'nas';
  const ports = new Set(device.openPorts);
  if (ports.has(62078)) return 'phone';
  if (ports.has(9100) || ports.has(631)) return 'printer';
  if (ports.has(554)) return 'camera';
  if (ports.has(8008) || ports.has(8009)) return 'tv';
  if (device.netbiosName || ports.has(445) || ports.has(3389)) return 'computer';
  if (device.isSelf) return 'phone';
  const fromBanners = device.fingerprint ? identify(device.fingerprint).kind : null;
  return fromBanners ?? 'unknown';
}

/** The most human-friendly name the scan found, or null. */
export function displayName(device: LanDevice): string | null {
  const friendly = device.services
    .map(service => service.txt.fn ?? service.txt.n ?? null)
    .find(value => value);
  const instance = device.services.find(service => !service.type.startsWith('_device-info'));
  return (
    device.upnp?.friendlyName ??
    friendly ??
    instance?.instance ??
    device.netbiosName ??
    device.hostname ??
    (device.mdnsHost ? device.mdnsHost.replace(/\.local\.?$/i, '') : null) ??
    (device.fingerprint ? identify(device.fingerprint).product : null)
  );
}

/** Model hint: UPnP model, or the `md`/`model`/`ty` TXT keys used by Cast, AirPlay and printers. */
export function modelName(device: LanDevice): string | null {
  const fromUpnp = [device.upnp?.manufacturer, device.upnp?.modelName].filter(Boolean).join(' ');
  if (fromUpnp) return fromUpnp;
  for (const service of device.services) {
    const value = service.txt.md ?? service.txt.model ?? service.txt.ty ?? service.txt.usb_mdl;
    if (value) return value;
  }
  // Brand from banners, or the network card's manufacturer.
  if (device.fingerprint) {
    return identify(device.fingerprint).brand ?? device.fingerprint.vendor;
  }
  return null;
}
