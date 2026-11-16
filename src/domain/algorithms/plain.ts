/**
 * Plain-language ratings for people who do not know what dBm or ms mean.
 * Thresholds follow common guidance for calls, games and video streaming.
 */

export type Rating = 'great' | 'good' | 'ok' | 'poor';

/** Round-trip time to a website. */
export function latencyRating(ms: number | null): Rating | null {
  if (ms === null) return null;
  if (ms < 30) return 'great';
  if (ms < 60) return 'good';
  if (ms < 120) return 'ok';
  return 'poor';
}

/** What a download speed is enough for. */
export type SpeedUse = 'basic' | 'hd' | 'uhd' | 'all';

export function speedUse(downloadMbps: number | null): SpeedUse | null {
  if (downloadMbps === null) return null;
  if (downloadMbps < 5) return 'basic';
  if (downloadMbps < 25) return 'hd';
  if (downloadMbps < 100) return 'uhd';
  return 'all';
}

/**
 * Mobile signal. 4G/5G report RSRP, where about -80 dBm is excellent and
 * -110 dBm is the edge of coverage; Android's 0–4 level is used otherwise.
 */
export function cellularRating(dbm: number | null, level: number | null): Rating | null {
  if (dbm !== null) {
    if (dbm >= -85) return 'great';
    if (dbm >= -95) return 'good';
    if (dbm >= -105) return 'ok';
    return 'poor';
  }
  if (level === null) return null;
  if (level >= 4) return 'great';
  if (level === 3) return 'good';
  if (level === 2) return 'ok';
  return 'poor';
}

/** Wi-Fi signal (RSSI). */
export function wifiRating(rssi: number | null): Rating | null {
  if (rssi === null) return null;
  if (rssi >= -55) return 'great';
  if (rssi >= -67) return 'good';
  if (rssi >= -75) return 'ok';
  return 'poor';
}

/**
 * Network name from Team Cymru's AS description, e.g.
 * `CLOUDFLARENET - Cloudflare, Inc., US` → `Cloudflare, Inc.`,
 * `BTC-AS, BG` → `BTC-AS`.
 */
export function providerDisplayName(asName: string): string {
  let name = asName.trim();
  const dash = name.indexOf(' - ');
  if (dash > 0) name = name.slice(dash + 3);
  return name.replace(/,\s*[A-Z]{2}$/, '').trim();
}

export type ConnectionSummary =
  | 'offline'
  | 'portal'
  | 'no-internet'
  | 'checking'
  | 'slow'
  | 'weak-signal'
  | 'good';

/** One sentence for the home screen: is everything fine, and if not, what is wrong. */
export function connectionSummary(input: {
  transport: string;
  hasInternet: boolean;
  isValidated: boolean;
  isCaptivePortal: boolean;
  signal: Rating | null;
  latencies: readonly (number | null)[];
}): ConnectionSummary {
  if (input.transport === 'none') return 'offline';
  if (input.isCaptivePortal) return 'portal';
  if (!input.hasInternet) return 'no-internet';
  if (!input.isValidated) return 'checking';
  if (input.signal === 'poor') return 'weak-signal';
  const measured = input.latencies.filter((value): value is number => value !== null);
  if (measured.length > 0) {
    const sorted = [...measured].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] as number;
    if (median >= 150) return 'slow';
  }
  return 'good';
}
