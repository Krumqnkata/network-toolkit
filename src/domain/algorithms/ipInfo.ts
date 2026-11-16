/**
 * Parsers for the public-IP lookups. Both sources are free and need no API key:
 *
 * - Cloudflare's `/cdn-cgi/trace` endpoint (`key=value` lines) for the public
 *   IP, country and Cloudflare data center.
 * - Team Cymru's IP-to-ASN DNS service (TXT records) for the AS number,
 *   announced prefix and network name.
 */

export function parseTrace(text: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of text.split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index > 0) result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  return result;
}

export interface AsnOrigin {
  asn: number;
  prefix: string;
  country: string;
  registry: string;
}

function fields(txt: string): string[] {
  return txt
    .replace(/^"|"$/g, '')
    .split('|')
    .map(field => field.trim());
}

/** `"13335 | 1.1.1.0/24 | AU | apnic | 2011-08-11"` → origin. Multi-origin prefixes keep the first ASN. */
export function parseCymruOrigin(txt: string): AsnOrigin | null {
  const [asns = '', prefix = '', country = '', registry = ''] = fields(txt);
  const asn = Number(asns.split(/\s+/)[0]);
  if (!Number.isInteger(asn) || asn <= 0 || prefix === '') return null;
  return { asn, prefix, country, registry };
}

/** `"13335 | US | arin | 2010-07-14 | CLOUDFLARENET - Cloudflare, Inc., US"` → name. */
export function parseCymruAsName(txt: string): string | null {
  const parts = fields(txt);
  const name = parts.slice(4).join('|').trim();
  return name === '' ? null : name;
}
