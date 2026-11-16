/**
 * "Where is the problem?" — splits the path from this phone to the internet
 * into segments and decides which one is to blame. Pure, unit-tested.
 *
 *   phone ──local──▶ router ──access──▶ provider ──internet──▶ internet
 *
 * On mobile data there is no router: the first segment is the radio link to
 * the operator.
 */

export type SegmentId = 'local' | 'access' | 'internet';
export type SegmentState = 'good' | 'warn' | 'bad' | 'unknown';

/** Round-trip samples of one probe target (null = lost). */
export interface ProbeSeries {
  host: string;
  samples: readonly (number | null)[];
}

export interface SeriesStats {
  sent: number;
  received: number;
  lossPercent: number;
  /** Median round-trip time; robust against single spikes. */
  medianMs: number | null;
  /** Mean absolute difference between consecutive replies. */
  jitterMs: number | null;
}

export function seriesStats(samples: readonly (number | null)[]): SeriesStats {
  const replies = samples.filter((value): value is number => value !== null);
  const sorted = [...replies].sort((a, b) => a - b);
  let jitter: number | null = null;
  if (replies.length > 1) {
    let sum = 0;
    for (let i = 1; i < replies.length; i++) {
      sum += Math.abs((replies[i] as number) - (replies[i - 1] as number));
    }
    jitter = Math.round((sum / (replies.length - 1)) * 10) / 10;
  }
  return {
    sent: samples.length,
    received: replies.length,
    lossPercent: samples.length
      ? Math.round(((samples.length - replies.length) / samples.length) * 100)
      : 0,
    medianMs: sorted.length ? (sorted[Math.floor(sorted.length / 2)] as number) : null,
    jitterMs: jitter,
  };
}

export interface Segment {
  id: SegmentId;
  state: SegmentState;
  /** Round-trip time this segment adds on top of the previous ones. */
  addedMs: number | null;
  lossPercent: number | null;
  jitterMs: number | null;
}

export type Verdict =
  | 'none'
  | 'local-wifi'
  | 'local-radio'
  | 'router'
  | 'access'
  | 'internet'
  | 'offline'
  | 'unknown';

export interface SegmentAnalysis {
  segments: Segment[];
  verdict: Verdict;
}

export interface SegmentInput {
  transport: string;
  /** Pings to the gateway; null on mobile data or without a gateway. */
  gateway: ProbeSeries | null;
  /** Pings to the first router beyond the gateway (the provider); null if not found. */
  provider: ProbeSeries | null;
  /** Pings to a well-connected internet host (1.1.1.1). */
  internet: ProbeSeries;
  /** Wi-Fi RSSI or cellular signal quality, for blaming the local link. */
  signalPoor: boolean;
}

/** Thresholds per segment: [warn, bad] for added latency (ms) and loss (%). */
const LIMITS: Record<SegmentId, { ms: [number, number]; loss: [number, number] }> = {
  local: { ms: [20, 60], loss: [2, 10] },
  access: { ms: [30, 80], loss: [3, 15] },
  internet: { ms: [80, 200], loss: [3, 15] },
};

function rate(id: SegmentId, addedMs: number | null, loss: number | null, jitter: number | null) {
  if (addedMs === null && loss === null) return 'unknown' as const;
  const limits = LIMITS[id];
  const ms = addedMs ?? 0;
  const lost = loss ?? 0;
  const shaky = jitter !== null && jitter > limits.ms[1];
  if (ms >= limits.ms[1] || lost >= limits.loss[1]) return 'bad' as const;
  if (ms >= limits.ms[0] || lost >= limits.loss[0] || shaky) return 'warn' as const;
  return 'good' as const;
}

/**
 * Loss and delay accumulate along the path, so each segment is judged by what
 * it adds: a lossy local link makes every later target lossy too, and is
 * blamed instead of them.
 */
export function analyzeSegments(input: SegmentInput): SegmentAnalysis {
  const gateway = input.gateway ? seriesStats(input.gateway.samples) : null;
  const provider = input.provider ? seriesStats(input.provider.samples) : null;
  const internet = seriesStats(input.internet.samples);

  if (input.transport === 'none') return { segments: [], verdict: 'offline' };

  // A gateway that answers nothing at all is usually a router that ignores ping.
  const gatewayUsable = gateway !== null && gateway.received > 0;
  const providerUsable = provider !== null && provider.received > 0;

  const localMs = gatewayUsable ? gateway.medianMs : null;
  const localLoss = gatewayUsable ? gateway.lossPercent : null;

  const accessBase = localMs ?? 0;
  const accessMs =
    providerUsable && provider.medianMs !== null
      ? Math.max(0, provider.medianMs - accessBase)
      : null;
  const accessLoss = providerUsable ? Math.max(0, provider.lossPercent - (localLoss ?? 0)) : null;

  const internetBase =
    providerUsable && provider.medianMs !== null ? provider.medianMs : accessBase;
  const internetMs =
    internet.medianMs !== null ? Math.max(0, internet.medianMs - internetBase) : null;
  const upstreamLoss = Math.max(localLoss ?? 0, providerUsable ? provider.lossPercent : 0);
  const internetLoss =
    internet.received === 0 ? 100 : Math.max(0, internet.lossPercent - upstreamLoss);

  const segments: Segment[] = [
    {
      id: 'local',
      state:
        input.signalPoor && !gatewayUsable
          ? 'warn'
          : rate('local', localMs, localLoss, gateway?.jitterMs ?? null),
      addedMs: localMs,
      lossPercent: localLoss,
      jitterMs: gatewayUsable ? gateway.jitterMs : null,
    },
    {
      id: 'access',
      state: rate('access', accessMs, accessLoss, provider?.jitterMs ?? null),
      addedMs: accessMs,
      lossPercent: accessLoss,
      jitterMs: providerUsable ? provider.jitterMs : null,
    },
    {
      id: 'internet',
      state: rate('internet', internetMs, internetLoss, internet.jitterMs),
      addedMs: internetMs,
      lossPercent: internetLoss,
      jitterMs: internet.jitterMs,
    },
  ];

  const [local, access, net] = segments as [Segment, Segment, Segment];
  const cellular = input.transport === 'cellular';
  let verdict: Verdict = 'none';
  if (local.state === 'bad' || (local.state === 'warn' && input.signalPoor)) {
    verdict = cellular ? 'local-radio' : 'local-wifi';
  } else if (!cellular && gateway !== null && gateway.received === 0 && internet.received === 0) {
    verdict = 'router';
  } else if (access.state === 'bad') {
    verdict = 'access';
  } else if (net.state === 'bad') {
    verdict = 'internet';
  } else if (local.state === 'warn') {
    verdict = cellular ? 'local-radio' : 'local-wifi';
  } else if (access.state === 'warn') {
    verdict = 'access';
  } else if (net.state === 'warn') {
    verdict = 'internet';
  } else if (internet.received === 0) {
    verdict = 'unknown';
  }
  // On mobile data the first measured hop is the operator: its delay includes the radio link.
  if (cellular && verdict === 'access') verdict = 'local-radio';
  return { segments, verdict };
}

/**
 * First router beyond the gateway on the path to the internet, from
 * traceroute hops (TTL order). Hops that equal the gateway or did not answer
 * are skipped.
 */
export function providerHop(
  hops: readonly { ttl: number; address: string | null }[],
  gateway: string | null,
): string | null {
  for (const hop of [...hops].sort((a, b) => a.ttl - b.ttl)) {
    if (hop.address && hop.address !== gateway) return hop.address;
  }
  return null;
}
