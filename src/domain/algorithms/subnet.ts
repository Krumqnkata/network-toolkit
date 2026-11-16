import { isIPv4 } from './ip';

/** Largest number of addresses the LAN scanner sweeps (a /22). */
export const MAX_SCAN_HOSTS = 1022;

export function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => acc * 256 + Number(part), 0);
}

export function intToIpv4(value: number): string {
  return [24, 16, 8, 0].map(shift => Math.floor(value / 2 ** shift) % 256).join('.');
}

export interface ScanRange {
  /** Network address and prefix actually scanned, e.g. `192.168.1.0/24`. */
  cidr: string;
  hosts: string[];
  /** True when the real subnet was larger and only the /24 around this device is scanned. */
  truncated: boolean;
}

/**
 * Host addresses to sweep for `address/prefix`, without the network and
 * broadcast addresses. Subnets larger than a /22 are reduced to the /24 that
 * contains `address`. Returns null for invalid input or point-to-point links.
 */
export function scanRange(address: string, prefix: number): ScanRange | null {
  if (!isIPv4(address) || !Number.isInteger(prefix) || prefix < 0 || prefix > 30) return null;
  const count = 2 ** (32 - prefix);
  const truncated = count - 2 > MAX_SCAN_HOSTS;
  const effectivePrefix = truncated ? 24 : prefix;
  const size = 2 ** (32 - effectivePrefix);
  const network = Math.floor(ipv4ToInt(address) / size) * size;
  const hosts: string[] = [];
  for (let offset = 1; offset < size - 1; offset++) hosts.push(intToIpv4(network + offset));
  return { cidr: `${intToIpv4(network)}/${effectivePrefix}`, hosts, truncated };
}

export function compareIpv4(a: string, b: string): number {
  return ipv4ToInt(a) - ipv4ToInt(b);
}

/** True when a MAC address is locally administered (typically a randomized, private MAC). */
export function isRandomizedMac(mac: string): boolean {
  const first = parseInt(mac.slice(0, 2), 16);
  // Bit 1 of the first octet is the locally-administered (U/L) bit.
  return Number.isFinite(first) && Math.floor(first / 2) % 2 === 1;
}
