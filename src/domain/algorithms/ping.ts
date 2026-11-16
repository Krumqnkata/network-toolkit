import type { PingStatus } from '../models/netTools';

export interface PingSample {
  seq: number;
  status: PingStatus;
  rttMs: number | null;
  ttl: number | null;
  timestamp: number;
}

export interface PingStats {
  sent: number;
  received: number;
  /** 0–100. */
  lossPercent: number;
  minMs: number | null;
  avgMs: number | null;
  maxMs: number | null;
  /**
   * Mean absolute difference between consecutive round-trip times (the
   * inter-arrival jitter idea from RFC 3550, without smoothing).
   */
  jitterMs: number | null;
}

const round = (value: number) => Math.round(value * 100) / 100;

export function pingStats(samples: readonly PingSample[]): PingStats {
  const rtts = samples
    .filter(sample => sample.status === 'reply' && sample.rttMs !== null)
    .map(sample => sample.rttMs as number);
  const sent = samples.length;
  const received = rtts.length;
  if (received === 0) {
    return {
      sent,
      received,
      lossPercent: sent === 0 ? 0 : 100,
      minMs: null,
      avgMs: null,
      maxMs: null,
      jitterMs: null,
    };
  }
  const sum = rtts.reduce((acc, value) => acc + value, 0);
  let jitter: number | null = null;
  if (rtts.length > 1) {
    let diff = 0;
    for (let i = 1; i < rtts.length; i++) {
      diff += Math.abs((rtts[i] as number) - (rtts[i - 1] as number));
    }
    jitter = round(diff / (rtts.length - 1));
  }
  return {
    sent,
    received,
    lossPercent: round(((sent - received) / sent) * 100),
    minMs: round(Math.min(...rtts)),
    avgMs: round(sum / received),
    maxMs: round(Math.max(...rtts)),
    jitterMs: jitter,
  };
}

/** Coarse latency quality used for colouring, aligned with common VoIP/gaming guidance. */
export function latencyLevel(rttMs: number | null): 'good' | 'fair' | 'poor' | 'none' {
  if (rttMs === null) return 'none';
  if (rttMs < 50) return 'good';
  if (rttMs < 150) return 'fair';
  return 'poor';
}
