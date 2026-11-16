/** DNS record types offered by the DNS Lookup tool (IANA codes). */
export const DNS_RECORD_TYPES = {
  A: 1,
  AAAA: 28,
  CNAME: 5,
  MX: 15,
  TXT: 16,
  NS: 2,
  SOA: 6,
  SRV: 33,
  CAA: 257,
  PTR: 12,
} as const;

export type DnsRecordTypeName = keyof typeof DNS_RECORD_TYPES;

export const DNS_RECORD_TYPE_NAMES = Object.keys(DNS_RECORD_TYPES) as DnsRecordTypeName[];

export function recordTypeName(code: number): string {
  const match = DNS_RECORD_TYPE_NAMES.find(name => DNS_RECORD_TYPES[name] === code);
  return match ?? `TYPE${code}`;
}

/** RFC 1035 / RFC 6895 response codes. */
const RCODES: Record<number, string> = {
  0: 'NOERROR',
  1: 'FORMERR',
  2: 'SERVFAIL',
  3: 'NXDOMAIN',
  4: 'NOTIMP',
  5: 'REFUSED',
};

export function rcodeName(rcode: number): string {
  return RCODES[rcode] ?? `RCODE${rcode}`;
}

export interface DnsServerOption {
  id: 'system' | 'cloudflare' | 'google' | 'quad9';
  /** null = Android's resolver for the active network. */
  address: string | null;
}

export const DNS_SERVERS: readonly DnsServerOption[] = [
  { id: 'system', address: null },
  { id: 'cloudflare', address: '1.1.1.1' },
  { id: 'google', address: '8.8.8.8' },
  { id: 'quad9', address: '9.9.9.9' },
];

/** Formats a TTL in seconds as `1h 5m`, `30s`, … */
export function formatTtl(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const units: [number, string][] = [
    [86_400, 'd'],
    [3600, 'h'],
    [60, 'm'],
    [1, 's'],
  ];
  const parts: string[] = [];
  let rest = Math.floor(seconds);
  for (const [size, label] of units) {
    if (rest >= size && parts.length < 2) {
      parts.push(`${Math.floor(rest / size)}${label}`);
      rest %= size;
    }
  }
  return parts.join(' ');
}

/** Removes the surrounding quotes from TXT character-strings and joins them. */
export function txtValue(data: string): string {
  const parts = data.match(/"((?:[^"\\]|\\.)*)"/g);
  if (!parts) return data;
  return parts.map(part => part.slice(1, -1).replace(/\\"/g, '"')).join('');
}
