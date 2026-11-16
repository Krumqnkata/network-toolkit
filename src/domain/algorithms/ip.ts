/** IP address helpers. Pure functions without any network access. */

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

export function isIPv4(value: string): boolean {
  return IPV4.test(value);
}

/**
 * Expands an IPv6 address to 8 groups of 4 hex digits, or returns null when it
 * is not a valid IPv6 literal. Accepts an embedded IPv4 tail (`::ffff:1.2.3.4`)
 * and ignores a zone index (`fe80::1%wlan0`).
 */
export function expandIPv6(value: string): string[] | null {
  let address = value.trim().replace(/^\[|\]$/g, '');
  const zone = address.indexOf('%');
  if (zone >= 0) address = address.slice(0, zone);
  if (!address.includes(':')) return null;

  const tail = address.slice(address.lastIndexOf(':') + 1);
  if (tail.includes('.')) {
    if (!isIPv4(tail)) return null;
    const [a, b, c, d] = tail.split('.').map(Number) as [number, number, number, number];
    const hex = (n: number) => n.toString(16);
    address = `${address.slice(0, address.lastIndexOf(':') + 1)}${hex(a * 256 + b)}:${hex(
      c * 256 + d,
    )}`;
  }

  const halves = address.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) => (part === '' ? [] : part.split(':'));
  const head = parse(halves[0] ?? '');
  const rest = halves.length === 2 ? parse(halves[1] ?? '') : [];
  const missing = 8 - head.length - rest.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;

  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest];
  if (!groups.every(group => /^[0-9a-fA-F]{1,4}$/.test(group))) return null;
  return groups.map(group => group.toLowerCase().padStart(4, '0'));
}

export function isIPv6(value: string): boolean {
  return expandIPv6(value) !== null;
}

export function isIpAddress(value: string): boolean {
  return isIPv4(value.trim()) || isIPv6(value);
}

function nibbles(groups: string[]): string[] {
  return groups.join('').split('').reverse();
}

/** PTR query name for an address: `4.3.2.1.in-addr.arpa` or the IPv6 nibble form. */
export function reverseDnsName(ip: string): string | null {
  const value = ip.trim();
  if (isIPv4(value)) return `${value.split('.').reverse().join('.')}.in-addr.arpa`;
  const groups = expandIPv6(value);
  return groups ? `${nibbles(groups).join('.')}.ip6.arpa` : null;
}

/**
 * Team Cymru IP-to-ASN query name (TXT): `d.c.b.a.origin.asn.cymru.com` or the
 * nibble form under `origin6.asn.cymru.com`.
 */
export function cymruOriginName(ip: string): string | null {
  const value = ip.trim();
  if (isIPv4(value)) return `${value.split('.').reverse().join('.')}.origin.asn.cymru.com`;
  const groups = expandIPv6(value);
  return groups ? `${nibbles(groups).join('.')}.origin6.asn.cymru.com` : null;
}

/** True for private, loopback, link-local and CGNAT IPv4 addresses. */
export function isPrivateIPv4(ip: string): boolean {
  if (!isIPv4(ip)) return false;
  const [a, b] = ip.split('.').map(Number) as [number, number];
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    (a === 100 && b >= 64 && b <= 127)
  );
}
