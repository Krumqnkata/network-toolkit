/**
 * Provider report: how much of the paid speed the connection delivers, and
 * when it is slowest. Pure, unit-tested.
 */

export interface PlanSpeed {
  downloadMbps: number | null;
  uploadMbps: number | null;
}

export interface ReportTest {
  at: number;
  downloadMbps: number | null;
  uploadMbps: number | null;
  pingMs: number | null;
  scheduled: boolean;
  transport: string | null;
  rssi: number | null;
}

export type DayPart = 'night' | 'morning' | 'afternoon' | 'evening';
export type ReportVerdict = 'good' | 'fair' | 'poor' | 'no-plan' | 'no-data';

export interface ProviderReport {
  /** Tests in the period that count (excluding weak Wi-Fi and mobile data). */
  tests: ReportTest[];
  excludedWeakWifi: number;
  excludedOther: number;
  medianDownload: number | null;
  medianUpload: number | null;
  minDownload: number | null;
  maxDownload: number | null;
  medianPing: number | null;
  /** Median as a share of the plan (%), when the plan is known. */
  downloadPercent: number | null;
  uploadPercent: number | null;
  /** Share of tests that reached at least `THRESHOLD` of the paid download speed (%). */
  reachedPercent: number | null;
  byDayPart: Record<DayPart, { tests: number; medianDownload: number | null }>;
  /** Day part with the lowest median, when clearly slower than the best one. */
  slowestPart: DayPart | null;
  /** How much slower the slowest day part is than the fastest (%). */
  slowdownPercent: number | null;
  verdict: ReportVerdict;
}

/** A test counts as "reached the plan" from this share of the paid speed. */
export const THRESHOLD = 0.8;
/** Below this Wi-Fi signal the phone, not the provider, limits the speed. */
export const WEAK_WIFI_DBM = -67;
/** Day parts this much slower than the best one are reported. */
const SLOWDOWN_REPORTED = 15;

export function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

export function dayPart(at: number): DayPart {
  const hour = new Date(at).getHours();
  if (hour < 6) return 'night';
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}

const round = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);
const percent = (value: number | null, of: number | null) =>
  value === null || !of ? null : Math.round((value / of) * 100);

export function buildProviderReport(
  all: readonly ReportTest[],
  plan: PlanSpeed,
  options: { now: number; days: number },
): ProviderReport {
  const since = options.now - options.days * 86_400_000;
  const inPeriod = all.filter(
    test => test.at >= since && test.at <= options.now && test.downloadMbps !== null,
  );
  // Mobile data and weak Wi-Fi measure the phone's link, not the provider.
  const wrongLink = inPeriod.filter(
    test => test.transport === 'cellular' || test.transport === 'none',
  );
  const weakWifi = inPeriod.filter(
    test => test.transport === 'wifi' && test.rssi !== null && test.rssi < WEAK_WIFI_DBM,
  );
  const tests = inPeriod
    .filter(test => !wrongLink.includes(test) && !weakWifi.includes(test))
    .sort((a, b) => a.at - b.at);

  const downloads = tests.map(test => test.downloadMbps!).filter(Number.isFinite);
  const uploads = tests.flatMap(test => (test.uploadMbps === null ? [] : [test.uploadMbps]));
  const pings = tests.flatMap(test => (test.pingMs === null ? [] : [test.pingMs]));
  const medianDownload = round(median(downloads));
  const medianUpload = round(median(uploads));

  const parts: DayPart[] = ['night', 'morning', 'afternoon', 'evening'];
  const byDayPart = Object.fromEntries(
    parts.map(part => {
      const values = tests
        .filter(test => dayPart(test.at) === part)
        .map(test => test.downloadMbps!);
      return [part, { tests: values.length, medianDownload: round(median(values)) }];
    }),
  ) as ProviderReport['byDayPart'];
  const measured = parts.filter(part => byDayPart[part].medianDownload !== null);
  let slowestPart: DayPart | null = null;
  let slowdownPercent: number | null = null;
  if (measured.length >= 2) {
    const sorted = [...measured].sort(
      (a, b) => byDayPart[a].medianDownload! - byDayPart[b].medianDownload!,
    );
    const slowest = sorted[0]!;
    const fastest = sorted[sorted.length - 1]!;
    const drop = Math.round(
      (1 - byDayPart[slowest].medianDownload! / byDayPart[fastest].medianDownload!) * 100,
    );
    if (drop >= SLOWDOWN_REPORTED) {
      slowestPart = slowest;
      slowdownPercent = drop;
    }
  }

  const planDown = plan.downloadMbps && plan.downloadMbps > 0 ? plan.downloadMbps : null;
  const downloadPercent = percent(medianDownload, planDown);
  const reachedPercent =
    planDown && downloads.length
      ? Math.round(
          (downloads.filter(value => value >= planDown * THRESHOLD).length / downloads.length) *
            100,
        )
      : null;
  const verdict: ReportVerdict = !tests.length
    ? 'no-data'
    : downloadPercent === null
    ? 'no-plan'
    : downloadPercent >= 90
    ? 'good'
    : downloadPercent >= THRESHOLD * 100
    ? 'fair'
    : 'poor';

  return {
    tests,
    excludedWeakWifi: weakWifi.length,
    excludedOther: wrongLink.length,
    medianDownload,
    medianUpload,
    minDownload: round(downloads.length ? Math.min(...downloads) : null),
    maxDownload: round(downloads.length ? Math.max(...downloads) : null),
    medianPing: round(median(pings)),
    downloadPercent,
    uploadPercent: percent(
      medianUpload,
      plan.uploadMbps && plan.uploadMbps > 0 ? plan.uploadMbps : null,
    ),
    reachedPercent,
    byDayPart,
    slowestPart,
    slowdownPercent,
    verdict,
  };
}

/** Comma-separated list of the tests, for a spreadsheet or a complaint. */
export function reportCsv(tests: readonly ReportTest[], plan: PlanSpeed): string {
  const header =
    'date_time,download_mbps,upload_mbps,ping_ms,connection,wifi_rssi_dbm,automatic,plan_download_mbps,plan_upload_mbps';
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = (at: number) => {
    const date = new Date(at);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  };
  const cell = (value: number | string | null) => (value === null ? '' : String(value));
  return [
    header,
    ...tests.map(test =>
      [
        stamp(test.at),
        cell(round(test.downloadMbps)),
        cell(round(test.uploadMbps)),
        cell(round(test.pingMs)),
        cell(test.transport),
        cell(test.rssi),
        test.scheduled ? 'yes' : 'no',
        cell(plan.downloadMbps),
        cell(plan.uploadMbps),
      ].join(','),
    ),
  ].join('\n');
}
