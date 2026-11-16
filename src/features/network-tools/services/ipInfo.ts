import { DNS_RECORD_TYPES, txtValue } from '../../../domain/algorithms/dns';
import { cymruOriginName } from '../../../domain/algorithms/ip';
import {
  parseCymruAsName,
  parseCymruOrigin,
  parseTrace,
  type AsnOrigin,
} from '../../../domain/algorithms/ipInfo';
import { dnsQuery } from '../../../native/netTools';
import { logError } from '../../../utils/errors';

/** Cloudflare's trace endpoint, reached over each IP family separately. */
export const TRACE_URLS = {
  ipv4: 'https://1.1.1.1/cdn-cgi/trace',
  ipv6: 'https://[2606:4700:4700::1111]/cdn-cgi/trace',
} as const;

export interface PublicAddress {
  ip: string;
  /** ISO 3166 country code reported by Cloudflare. */
  country: string | null;
  /** IATA code of the Cloudflare data center that answered. */
  colo: string | null;
  origin: (AsnOrigin & { name: string | null }) | null;
}

export interface PublicIpInfo {
  ipv4: PublicAddress | null;
  ipv6: PublicAddress | null;
}

async function fetchTrace(url: string, timeoutMs: number): Promise<Record<string, string> | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!response.ok) return null;
    return parseTrace(await response.text());
  } catch (error) {
    // No connectivity over this IP family is a normal outcome (e.g. no IPv6).
    logError('ip-info', error);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function firstTxt(name: string): Promise<string | null> {
  const result = await dnsQuery(name, DNS_RECORD_TYPES.TXT, null, 5000);
  const record = result.answers.find(answer => answer.type === DNS_RECORD_TYPES.TXT);
  return record ? txtValue(record.data) : null;
}

/** AS number, prefix and network name from Team Cymru's DNS service. */
export async function lookupOrigin(ip: string): Promise<PublicAddress['origin']> {
  const query = cymruOriginName(ip);
  if (!query) return null;
  try {
    const originTxt = await firstTxt(query);
    const origin = originTxt ? parseCymruOrigin(originTxt) : null;
    if (!origin) return null;
    const nameTxt = await firstTxt(`AS${origin.asn}.asn.cymru.com`);
    return { ...origin, name: nameTxt ? parseCymruAsName(nameTxt) : null };
  } catch (error) {
    logError('ip-info', error);
    return null;
  }
}

async function lookupFamily(url: string, timeoutMs: number): Promise<PublicAddress | null> {
  const trace = await fetchTrace(url, timeoutMs);
  const ip = trace?.ip;
  if (!trace || !ip) return null;
  return {
    ip,
    country: trace.loc ?? null,
    colo: trace.colo ?? null,
    origin: await lookupOrigin(ip),
  };
}

export async function lookupPublicIp(timeoutMs = 8000): Promise<PublicIpInfo> {
  const [ipv4, ipv6] = await Promise.all([
    lookupFamily(TRACE_URLS.ipv4, timeoutMs),
    lookupFamily(TRACE_URLS.ipv6, timeoutMs),
  ]);
  return { ipv4, ipv6 };
}
