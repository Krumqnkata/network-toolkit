/** Formats a rate in Mbit/s: one decimal below 100, whole numbers above. */
export function formatMbps(value: number | null): string {
  if (value === null) return '—';
  return value < 100 ? value.toFixed(1) : value.toFixed(0);
}

/** Bytes as `850 MB` / `1.2 GB` (decimal units, like mobile data plans). */
export function formatBytes(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.round(bytes / 1000)} kB`;
  if (bytes < 1_000_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
}

export const GAUGE_MAX_MBPS = 1000;

/**
 * Position 0–1 on the speed gauge. A square-root scale keeps everyday speeds
 * (10–300 Mbit/s) readable while still reaching 1 Gbit/s.
 */
export function gaugeFraction(mbps: number | null, max = GAUGE_MAX_MBPS): number {
  if (mbps === null || mbps <= 0) return 0;
  return Math.min(1, Math.sqrt(mbps / max));
}

/** Extra latency under load compared with the idle latency (a bufferbloat indicator). */
export function latencyIncrease(idle: number | null, loaded: number | null): number | null {
  if (idle === null || loaded === null) return null;
  return Math.max(0, loaded - idle);
}

export type BloatLevel = 'low' | 'moderate' | 'high';

/** Coarse bufferbloat rating from the latency increase under load, in ms. */
export function bloatLevel(increaseMs: number | null): BloatLevel | null {
  if (increaseMs === null) return null;
  if (increaseMs < 30) return 'low';
  if (increaseMs < 100) return 'moderate';
  return 'high';
}
