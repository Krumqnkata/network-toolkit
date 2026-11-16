import type { MonitorSample, Outage } from '../../database/repositories';

/** Consecutive lost probes that count as an outage. */
export const OUTAGE_THRESHOLD = 3;

export interface MonitorStats {
  sent: number;
  received: number;
  lossPercent: number;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  /** Mean absolute difference between consecutive replies. */
  jitterMs: number | null;
}

/** Running totals, updated per probe so long sessions stay O(1) per sample. */
export interface MonitorAccumulator {
  sent: number;
  received: number;
  sum: number;
  min: number | null;
  max: number | null;
  jitterSum: number;
  jitterCount: number;
  lastRtt: number | null;
  lossStreak: number;
  outages: Outage[];
}

export function emptyAccumulator(): MonitorAccumulator {
  return {
    sent: 0,
    received: 0,
    sum: 0,
    min: null,
    max: null,
    jitterSum: 0,
    jitterCount: 0,
    lastRtt: null,
    lossStreak: 0,
    outages: [],
  };
}

/**
 * Adds one probe. An outage starts at the first of `OUTAGE_THRESHOLD`
 * consecutive losses and ends at the next reply.
 */
export function accumulate(
  acc: MonitorAccumulator,
  sample: MonitorSample,
  intervalMs: number,
): MonitorAccumulator {
  const next: MonitorAccumulator = { ...acc, sent: acc.sent + 1, outages: acc.outages };
  if (sample.rtt === null) {
    next.lossStreak = acc.lossStreak + 1;
    if (next.lossStreak === OUTAGE_THRESHOLD) {
      next.outages = [
        ...acc.outages,
        { start: sample.t - (OUTAGE_THRESHOLD - 1) * intervalMs, end: null },
      ];
    }
    return next;
  }
  next.received = acc.received + 1;
  next.sum = acc.sum + sample.rtt;
  next.min = acc.min === null ? sample.rtt : Math.min(acc.min, sample.rtt);
  next.max = acc.max === null ? sample.rtt : Math.max(acc.max, sample.rtt);
  if (acc.lastRtt !== null) {
    next.jitterSum = acc.jitterSum + Math.abs(sample.rtt - acc.lastRtt);
    next.jitterCount = acc.jitterCount + 1;
  }
  next.lastRtt = sample.rtt;
  next.lossStreak = 0;
  const open = acc.outages[acc.outages.length - 1];
  if (open && open.end === null) {
    next.outages = [...acc.outages.slice(0, -1), { ...open, end: sample.t }];
  }
  return next;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function statsOf(acc: MonitorAccumulator): MonitorStats {
  return {
    sent: acc.sent,
    received: acc.received,
    lossPercent: acc.sent === 0 ? 0 : round(((acc.sent - acc.received) / acc.sent) * 100),
    minMs: acc.min === null ? null : round(acc.min),
    avgMs: acc.received === 0 ? null : round(acc.sum / acc.received),
    maxMs: acc.max === null ? null : round(acc.max),
    jitterMs: acc.jitterCount === 0 ? null : round(acc.jitterSum / acc.jitterCount),
  };
}

export function outageDurationMs(outage: Outage, now: number): number {
  return (outage.end ?? now) - outage.start;
}

/** Share of the session without an outage, 0–100. */
export function uptimePercent(outages: readonly Outage[], start: number, end: number): number {
  const total = end - start;
  if (total <= 0) return 100;
  const down = outages.reduce(
    (sum, outage) => sum + Math.min(outageDurationMs(outage, end), total),
    0,
  );
  return round(Math.max(0, 100 - (down / total) * 100));
}

/**
 * Reduces samples to at most `max` by averaging buckets; a bucket in which
 * every probe was lost stays a loss (null).
 */
export function downsample(samples: readonly MonitorSample[], max: number): MonitorSample[] {
  if (samples.length <= max) return [...samples];
  const size = Math.ceil(samples.length / max);
  const result: MonitorSample[] = [];
  for (let i = 0; i < samples.length; i += size) {
    const bucket = samples.slice(i, i + size);
    const replies = bucket
      .filter(sample => sample.rtt !== null)
      .map(sample => sample.rtt as number);
    result.push({
      t: (bucket[0] as MonitorSample).t,
      rtt: replies.length ? round(replies.reduce((a, b) => a + b, 0) / replies.length) : null,
    });
  }
  return result;
}

/** `1 h 5 min`, `4 min 10 s`, `12 s`. */
export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h} h ${m} min`;
  if (m > 0) return `${m} min ${s} s`;
  return `${s} s`;
}
