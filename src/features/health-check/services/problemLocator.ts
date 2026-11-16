import { isIPv4 } from '../../../domain/algorithms/ip';
import {
  analyzeSegments,
  providerHop,
  type ProbeSeries,
  type SegmentAnalysis,
} from '../../../domain/algorithms/segments';
import { cellularRating, wifiRating } from '../../../domain/algorithms/plain';
import type { NetworkSnapshot } from '../../../domain/models/network';
import { ping } from '../../../native/netTools';
import { logError } from '../../../utils/errors';

export const INTERNET_HOST = '1.1.1.1';
export const PROBES = 8;
/** Pause between pings; tests set it to 0. */
export const locatorTiming = { spacingMs: 250 };
const TIMEOUT_MS = 1000;
/** Hops searched for the provider's first router. */
const MAX_PROVIDER_TTL = 4;

export interface ProblemLocation extends SegmentAnalysis {
  gateway: string | null;
  provider: string | null;
  internet: string;
}

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** `PROBES` pings to one host, a quarter second apart. */
export async function probeSeries(host: string): Promise<ProbeSeries> {
  const samples: (number | null)[] = [];
  for (let i = 0; i < PROBES; i++) {
    try {
      const reply = await ping(host, { family: 'ipv4', timeoutMs: TIMEOUT_MS });
      samples.push(reply.status === 'reply' ? reply.rttMs : null);
    } catch (error) {
      logError('locator', error);
      samples.push(null);
    }
    if (i < PROBES - 1) await delay(locatorTiming.spacingMs);
  }
  return { host, samples };
}

/** The provider's first router: the first traceroute hop after the gateway. */
async function findProvider(gateway: string | null): Promise<string | null> {
  const hops: { ttl: number; address: string | null }[] = [];
  for (let ttl = 1; ttl <= MAX_PROVIDER_TTL; ttl++) {
    try {
      const probe = await ping(INTERNET_HOST, { family: 'ipv4', ttl, timeoutMs: 1500 });
      if (probe.status === 'reply') break; // reached the target: no router in between answered
      hops.push({ ttl, address: probe.from });
      const found = providerHop(hops, gateway);
      if (found) return found;
    } catch (error) {
      // Traceroute is unavailable on devices that block ICMP for apps.
      logError('locator', error);
      return null;
    }
  }
  return null;
}

/**
 * Measures the local link (gateway), the provider's first router and the
 * internet in parallel, then decides which segment causes trouble.
 */
export async function locateProblem(snapshot: NetworkSnapshot): Promise<ProblemLocation> {
  const gateway = snapshot.transport === 'cellular' ? null : snapshot.gateways.find(isIPv4) ?? null;
  const [gatewaySeries, provider, internet] = await Promise.all([
    gateway ? probeSeries(gateway) : Promise.resolve(null),
    findProvider(gateway),
    probeSeries(INTERNET_HOST),
  ]);
  const providerSeries = provider ? await probeSeries(provider) : null;
  const signal =
    snapshot.transport === 'cellular'
      ? cellularRating(snapshot.cellularDbm, snapshot.cellularLevel)
      : wifiRating(snapshot.wifi?.rssi ?? null);
  const analysis = analyzeSegments({
    transport: snapshot.transport,
    gateway: gatewaySeries,
    provider: providerSeries,
    internet,
    signalPoor: signal === 'poor',
  });
  return { ...analysis, gateway, provider, internet: INTERNET_HOST };
}
