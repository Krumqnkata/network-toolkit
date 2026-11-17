import {
  buildProviderReport,
  dayPart,
  median,
  reportCsv,
  type ReportTest,
} from '../providerReport';

const NOW = new Date(2026, 10, 17, 12, 0).getTime();
const at = (daysAgo: number, hour: number) => {
  const date = new Date(NOW - daysAgo * 86_400_000);
  date.setHours(hour, 0, 0, 0);
  return date.getTime();
};
const test = (time: number, down: number, extra: Partial<ReportTest> = {}): ReportTest => ({
  at: time,
  downloadMbps: down,
  uploadMbps: down / 2,
  pingMs: 12,
  scheduled: true,
  transport: 'wifi',
  rssi: -55,
  ...extra,
});
const plan = { downloadMbps: 500, uploadMbps: 250 };

describe('helpers', () => {
  it('takes medians and splits the day', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
    expect(dayPart(new Date(2026, 0, 1, 3).getTime())).toBe('night');
    expect(dayPart(new Date(2026, 0, 1, 9).getTime())).toBe('morning');
    expect(dayPart(new Date(2026, 0, 1, 15).getTime())).toBe('afternoon');
    expect(dayPart(new Date(2026, 0, 1, 21).getTime())).toBe('evening');
  });
});

describe('buildProviderReport', () => {
  it('rates a connection that delivers the plan', () => {
    const report = buildProviderReport(
      [test(at(1, 3), 480), test(at(2, 9), 470), test(at(3, 15), 490)],
      plan,
      { now: NOW, days: 7 },
    );
    expect(report).toMatchObject({
      verdict: 'good',
      medianDownload: 480,
      downloadPercent: 96,
      uploadPercent: 96,
      reachedPercent: 100,
      minDownload: 470,
      maxDownload: 490,
      medianPing: 12,
      slowestPart: null,
    });
  });

  it('finds the evening slowdown and a poor result', () => {
    const report = buildProviderReport(
      [
        test(at(1, 2), 300),
        test(at(2, 3), 320),
        test(at(1, 20), 120),
        test(at(2, 21), 140),
        test(at(3, 10), 260),
      ],
      plan,
      { now: NOW, days: 7 },
    );
    expect(report.verdict).toBe('poor');
    expect(report.downloadPercent).toBe(52);
    expect(report.reachedPercent).toBe(0);
    expect(report.byDayPart.evening).toEqual({ tests: 2, medianDownload: 130 });
    expect(report).toMatchObject({ slowestPart: 'evening', slowdownPercent: 58 });
  });

  it('leaves out weak Wi-Fi, mobile data and old tests', () => {
    const report = buildProviderReport(
      [
        test(at(1, 10), 450),
        test(at(1, 11), 90, { rssi: -78 }),
        test(at(1, 12), 40, { transport: 'cellular', rssi: null }),
        test(at(20, 12), 10),
        test(at(1, 13), 460, { transport: 'ethernet', rssi: null }),
      ],
      plan,
      { now: NOW, days: 7 },
    );
    expect(report.tests).toHaveLength(2);
    expect(report).toMatchObject({ excludedWeakWifi: 1, excludedOther: 1, verdict: 'good' });
  });

  it('works without a plan or tests', () => {
    expect(
      buildProviderReport(
        [test(at(1, 10), 100)],
        { downloadMbps: null, uploadMbps: null },
        { now: NOW, days: 7 },
      ),
    ).toMatchObject({
      verdict: 'no-plan',
      downloadPercent: null,
      reachedPercent: null,
    });
    expect(buildProviderReport([], plan, { now: NOW, days: 7 }).verdict).toBe('no-data');
  });
});

describe('reportCsv', () => {
  it('writes one row per test', () => {
    const csv = reportCsv(
      [test(new Date(2026, 10, 16, 21, 5).getTime(), 123.45, { scheduled: false })],
      plan,
    );
    expect(csv.split('\n')).toEqual([
      'date_time,download_mbps,upload_mbps,ping_ms,connection,wifi_rssi_dbm,automatic,plan_download_mbps,plan_upload_mbps',
      '2026-11-16 21:05,123.5,61.7,12,wifi,-55,no,500,250',
    ]);
  });
});
