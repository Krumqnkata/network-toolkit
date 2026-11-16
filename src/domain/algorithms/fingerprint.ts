/**
 * Device identification from what a device reveals when asked: the TTL of its
 * ping replies, its web server's headers and page title, its SSH greeting and
 * its TLS certificate. Pure, unit-tested.
 */
import type { DeviceKind } from './devices';

/** Operating system family from the initial TTL of ping replies. */
export type OsFamily = 'unix' | 'windows' | 'network';

export interface HttpBanner {
  status: number | null;
  server: string | null;
  /** Page title or the Basic/Digest authentication realm. */
  title: string | null;
  realm: string | null;
}

export interface SshBanner {
  /** e.g. `OpenSSH 9.6p1`, `dropbear 2022.83`. */
  software: string;
  /** Distribution or OS named in the greeting, e.g. `Ubuntu`. */
  os: string | null;
}

export interface Fingerprint {
  ttl: number | null;
  os: OsFamily | null;
  http: HttpBanner | null;
  ssh: SshBanner | null;
  /** Certificate subject common name and issuer organisation of the HTTPS server. */
  tlsSubject: string | null;
  tlsIssuer: string | null;
  /** Manufacturer from the MAC address (IEEE registry). */
  vendor: string | null;
}

export interface Identification {
  kind: DeviceKind | null;
  /** Brand found in banners, e.g. `MikroTik`, `Synology`. */
  brand: string | null;
  /** Human-friendly product or page name, e.g. `Archer AX55`. */
  product: string | null;
}

/**
 * Systems start with TTL 64 (Linux, Android, Apple, most IoT), 128 (Windows)
 * or 255 (routers, printers, embedded stacks); each router on the way takes
 * one off, so the reply's TTL is mapped to the next initial value up.
 */
export function osFromTtl(ttl: number | null): OsFamily | null {
  if (ttl === null || ttl <= 0 || ttl > 255) return null;
  if (ttl <= 64) return 'unix';
  if (ttl <= 128) return 'windows';
  return 'network';
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  copy: '©',
  reg: '®',
  trade: '™',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === '#') {
      const value =
        code[1] === 'x' || code[1] === 'X'
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isFinite(value) && value > 0 && value < 0x110000
        ? String.fromCodePoint(value)
        : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

const clean = (value: string | null | undefined, max = 80) => {
  if (!value) return null;
  const text = decodeEntities(value).replace(/\s+/g, ' ').trim();
  return text ? text.slice(0, max) : null;
};

/** Status, `Server` header, page `<title>` and auth realm from a raw HTTP reply. */
export function parseHttpBanner(text: string): HttpBanner | null {
  const statusMatch = /^HTTP\/\d(?:\.\d)?\s+(\d{3})/.exec(text);
  if (!statusMatch) return null;
  const headerEnd = text.search(/\r?\n\r?\n/);
  const head = headerEnd >= 0 ? text.slice(0, headerEnd) : text;
  const body = headerEnd >= 0 ? text.slice(headerEnd) : '';
  const header = (name: string) =>
    new RegExp(`^${name}:[ \\t]*(.+)$`, 'im').exec(head)?.[1]?.trim() ?? null;
  const realm = /realm="([^"]*)"/i.exec(header('WWW-Authenticate') ?? '')?.[1] ?? null;
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(body)?.[1] ?? null;
  return {
    status: Number(statusMatch[1]),
    server: clean(header('Server')),
    title: clean(title),
    realm: clean(realm),
  };
}

const SSH_OS: [RegExp, string][] = [
  [/ubuntu/i, 'Ubuntu'],
  [/raspbian/i, 'Raspberry Pi OS'],
  [/debian/i, 'Debian'],
  [/freebsd/i, 'FreeBSD'],
  [/openbsd/i, 'OpenBSD'],
  [/centos|rhel|red ?hat|fedora/i, 'Red Hat / Fedora'],
  [/windows/i, 'Windows'],
];

/** `SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13` → OpenSSH 9.6p1 on Ubuntu. */
export function parseSshBanner(text: string): SshBanner | null {
  const line = /^SSH-[\d.]+-(\S+)(?:[ \t]+([^\r\n]*))?/m.exec(text);
  if (!line) return null;
  const [, product = '', comment = ''] = line;
  const software = product.replace(/_/g, ' ').slice(0, 60);
  const os = SSH_OS.find(([pattern]) => pattern.test(`${product} ${comment}`))?.[1] ?? null;
  return { software, os };
}

/** `CN=FRITZ!Box,O=AVM` → `FRITZ!Box`; falls back to the first value. */
export function certificateName(dn: string | null): string | null {
  if (!dn) return null;
  const cn = /(?:^|,\s*)CN=([^,]+)/i.exec(dn)?.[1] ?? /[=]([^,]+)/.exec(dn)?.[1] ?? null;
  return clean(cn, 60);
}

export function certificateOrganization(dn: string | null): string | null {
  return clean(/(?:^|,\s*)O=([^,]+)/i.exec(dn ?? '')?.[1], 60);
}

/** Brand and device type from words found in banners and certificates. */
const RULES: [RegExp, string, DeviceKind | null][] = [
  [/mikrotik|routeros/i, 'MikroTik', 'router'],
  [/fritz!?\s?box|\bavm\b/i, 'AVM FRITZ!', 'router'],
  [/ubiquiti|unifi|edgeos|airos|\bubnt\b/i, 'Ubiquiti', 'router'],
  [/tp-?link|archer\s|\bdeco\b|omada/i, 'TP-Link', 'router'],
  [/netgear|nighthawk|\borbi\b/i, 'Netgear', 'router'],
  [/\basus\b|\brt-a[cx]\d|zenwifi/i, 'ASUS', 'router'],
  [/d-?link/i, 'D-Link', 'router'],
  [/linksys|velop/i, 'Linksys', 'router'],
  [/openwrt|luci/i, 'OpenWrt', 'router'],
  [/pfsense|opnsense/i, 'pfSense / OPNsense', 'router'],
  [/huawei|echolife|\bhg\d{3,}/i, 'Huawei', 'router'],
  [/\bzte\b|zxhn/i, 'ZTE', 'router'],
  [/keenetic|zyxel/i, 'Keenetic / Zyxel', 'router'],
  [/sagemcom|technicolor|arcadyan|vodafone station/i, 'Provider router', 'router'],
  [/synology|diskstation/i, 'Synology', 'nas'],
  [/qnap/i, 'QNAP', 'nas'],
  [/truenas|freenas/i, 'TrueNAS', 'nas'],
  [/plex media server/i, 'Plex', 'nas'],
  [/laserjet|officejet|deskjet|hp http server/i, 'HP', 'printer'],
  [/epson/i, 'Epson', 'printer'],
  [/brother/i, 'Brother', 'printer'],
  [/canon/i, 'Canon', 'printer'],
  [/kyocera|xerox|ricoh|lexmark/i, 'Printer', 'printer'],
  [/hikvision/i, 'Hikvision', 'camera'],
  [/dahua/i, 'Dahua', 'camera'],
  [/reolink/i, 'Reolink', 'camera'],
  [/home assistant/i, 'Home Assistant', 'iot'],
  [/shelly/i, 'Shelly', 'iot'],
  [/tasmota/i, 'Tasmota', 'iot'],
  [/esphome|esp8266|esp32|espressif/i, 'Espressif', 'iot'],
  [/philips hue|hue bridge/i, 'Philips Hue', 'iot'],
  [/sonos/i, 'Sonos', 'speaker'],
  [/roku|webos|tizen|bravia|android tv/i, 'Smart TV', 'tv'],
  [/pi-?hole/i, 'Pi-hole', 'computer'],
  [/raspberry/i, 'Raspberry Pi', 'computer'],
  [/microsoft-iis|microsoft-httpapi|windows/i, 'Windows', 'computer'],
];

/** MAC makers whose devices on a home network are nearly always one type. */
const VENDOR_RULES: [RegExp, string, DeviceKind | null][] = [
  [/^raspberry pi/i, 'Raspberry Pi', 'computer'],
  [/^synology/i, 'Synology', 'nas'],
  [/^qnap/i, 'QNAP', 'nas'],
  [/^mikrotik/i, 'MikroTik', 'router'],
  [/^avm/i, 'AVM FRITZ!', 'router'],
  [/^sonos$/i, 'Sonos', 'speaker'],
  [/^(hikvision|hangzhou hikvision)/i, 'Hikvision', 'camera'],
  [/^(dahua|zhejiang dahua)/i, 'Dahua', 'camera'],
  [/^espressif/i, 'Espressif', 'iot'],
  [/^(brother|seiko epson|canon)/i, 'Printer', 'printer'],
];

/** Generic titles that say nothing about the device. */
const GENERIC_TITLE =
  /^(index of|welcome|login|log in|sign in|home|redirect|loading|untitled|error|401|403|404|document|web ?ui|router|it works!?|default page)\b/i;

export function identify(fingerprint: Fingerprint): Identification {
  const { http, ssh } = fingerprint;
  const tlsName = certificateName(fingerprint.tlsSubject);
  const corpus = [
    http?.server,
    http?.title,
    http?.realm,
    ssh?.software,
    ssh?.os,
    tlsName,
    fingerprint.tlsIssuer,
  ]
    .filter(Boolean)
    .join(' \n ');

  // Banners name the product; the MAC maker only hints (TP-Link also makes plugs),
  // so it counts only for makers whose network devices are all of one type.
  const rule =
    RULES.find(([pattern]) => pattern.test(corpus)) ??
    (fingerprint.vendor
      ? VENDOR_RULES.find(([pattern]) => pattern.test(fingerprint.vendor!))
      : undefined);
  let kind: DeviceKind | null = rule?.[2] ?? null;
  if (!kind && fingerprint.os === 'windows') kind = 'computer';
  if (!kind && ssh && /dropbear/i.test(ssh.software)) kind = 'router';
  if (!kind && ssh?.os && ssh.os !== 'Windows') kind = 'computer';

  // A page title or realm usually names the product ("Archer AX55", "FRITZ!Box 7590").
  const candidates = [http?.title, http?.realm, tlsName].filter(
    (value): value is string =>
      !!value && !GENERIC_TITLE.test(value) && !/^[\d.:]+$/.test(value) && value.length >= 3,
  );
  return {
    kind,
    brand: rule?.[1] ?? null,
    product: candidates[0] ?? null,
  };
}
