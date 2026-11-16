import { z } from 'zod';

import { Repository } from '../../../database/storage';
import { wifiSnapshot } from '../../../../tests/fixtures/networkSnapshot';
import { network } from '../../../../tests/fixtures/wifiScan';
import type { CheckResult } from '../../../features/network-tools/services/reachability';
import { fillTemplate } from '../../../features/reports/formatReport';
import NativeStorageModule from '../../../native/specs/NativeStorageModule';
import { hydrateSettings, useSettingsStore } from '../../../stores/settingsStore';
import { diagnose, type DiagnosisInput } from '../diagnosis';
import {
  accumulate,
  downsample,
  emptyAccumulator,
  formatDuration,
  OUTAGE_THRESHOLD,
  statsOf,
  uptimePercent,
} from '../monitor';

describe('monitor accumulator', () => {
  it('computes stats and detects outages of 3+ consecutive losses', () => {
    const rtts = [10, 20, null, null, null, null, 15, null, 12];
    let acc = emptyAccumulator();
    rtts.forEach((rtt, index) => {
      acc = accumulate(acc, { t: index * 2000, rtt }, 2000);
    });
    expect(statsOf(acc)).toEqual({
      sent: 9,
      received: 4,
      lossPercent: 55.56,
      minMs: 10,
      avgMs: 14.25,
      maxMs: 20,
      jitterMs: 6, // (|20-10| + |15-20| + |12-15|) / 3
    });
  });

  it('opens and closes outages at the right times', () => {
    let acc = emptyAccumulator();
    const push = (t: number, rtt: number | null) => {
      acc = accumulate(acc, { t, rtt }, 2000);
    };
    push(0, 10);
    for (let i = 1; i <= OUTAGE_THRESHOLD; i++) push(i * 2000, null);
    expect(acc.outages).toEqual([{ start: 2000, end: null }]);
    push(8000, 11);
    expect(acc.outages).toEqual([{ start: 2000, end: 8000 }]);
    // Two losses are not an outage.
    push(10_000, null);
    push(12_000, null);
    push(14_000, 9);
    expect(acc.outages).toHaveLength(1);
  });

  it('reports uptime, downsampling and durations', () => {
    expect(uptimePercent([{ start: 10_000, end: 20_000 }], 0, 100_000)).toBe(90);
    expect(uptimePercent([{ start: 90_000, end: null }], 0, 100_000)).toBe(90);
    expect(uptimePercent([], 0, 0)).toBe(100);
    const samples = Array.from({ length: 10 }, (_, i) => ({ t: i, rtt: i < 4 ? null : i }));
    expect(downsample(samples, 5)).toEqual([
      { t: 0, rtt: null },
      { t: 2, rtt: null },
      { t: 4, rtt: 4.5 },
      { t: 6, rtt: 6.5 },
      { t: 8, rtt: 8.5 },
    ]);
    expect(downsample(samples, 20)).toHaveLength(10);
    expect(formatDuration(12_400)).toBe('12 s');
    expect(formatDuration(250_000)).toBe('4 min 10 s');
    expect(formatDuration(3_900_000)).toBe('1 h 5 min');
  });
});

describe('diagnose', () => {
  const pass = (id: CheckResult['id'], ms = 10): CheckResult => ({
    id,
    state: 'pass',
    detail: { kind: 'latency', target: 'x', ms },
  });
  const allPass = (['gateway', 'dns', 'internet', 'https'] as const).map(id => pass(id));
  const base: DiagnosisInput = {
    snapshot: { ...wifiSnapshot, wifi: { ...wifiSnapshot.wifi!, rssi: -50, frequencyMhz: 5180 } },
    checks: [
      ...allPass,
      { id: 'captive', state: 'pass', detail: { kind: 'no-portal' } },
      pass('ipv6'),
    ],
    scan: null,
    speed: null,
  };

  it('reports a healthy connection', () => {
    expect(diagnose(base).map(finding => finding.id)).toEqual(['all-good']);
  });

  it('flags offline networks only', () => {
    expect(diagnose({ ...base, snapshot: { ...base.snapshot, transport: 'none' } })).toEqual([
      { id: 'offline', severity: 'problem', values: {} },
    ]);
  });

  it('orders problems before warnings and info', () => {
    const findings = diagnose({
      ...base,
      snapshot: {
        ...base.snapshot,
        isVpn: true,
        wifi: { ...base.snapshot.wifi!, rssi: -80, security: 'wep', frequencyMhz: 2437 },
      },
      checks: [
        pass('gateway'),
        pass('dns', 400),
        { id: 'internet', state: 'fail', detail: { kind: 'error', message: 'timeout' } },
        { id: 'captive', state: 'warn', detail: { kind: 'portal', status: 302 } },
        { id: 'ipv6', state: 'warn', detail: { kind: 'error', message: 'unreachable' } },
      ],
      speed: { packetLossPercent: 5, idleLatencyMs: 10, loadedLatencyMs: 250 },
    });
    expect(findings.map(finding => [finding.id, finding.severity])).toEqual([
      ['weak-signal', 'problem'],
      ['insecure-wifi', 'problem'],
      ['internet-unreachable', 'problem'],
      ['captive-portal', 'problem'],
      ['dns-slow', 'warning'],
      ['packet-loss', 'warning'],
      ['bufferbloat', 'warning'],
      ['vpn', 'info'],
      ['band-2g', 'info'],
      ['no-ipv6', 'info'],
    ]);
    expect(findings[0]?.values).toEqual({ rssi: -80 });
    expect(findings.find(finding => finding.id === 'bufferbloat')?.values).toEqual({ ms: 240 });
  });

  it('uses the Wi-Fi scan to detect a busy channel', () => {
    const own = network({ bssid: 'aa:bb:cc:dd:ee:ff', frequencyMhz: 2437, rssi: -50 });
    const neighbours = Array.from({ length: 4 }, (_, i) =>
      network({ bssid: `00:00:00:00:00:0${i}`, frequencyMhz: 2437, rssi: -45 }),
    );
    const findings = diagnose({ ...base, scan: [own, ...neighbours] });
    expect(findings.find(finding => finding.id === 'congested-channel')?.values).toEqual({
      overlapping: 4,
    });
  });
});

describe('storage', () => {
  const schema = z.object({ value: z.number() });

  it('stores, lists newest first, prunes and skips invalid documents', async () => {
    const repo = new Repository('speed-result', schema, 2);
    await repo.add({ value: 1 }, 1000);
    await repo.add({ value: 2 }, 2000);
    await repo.add({ value: 3 }, 3000);
    await new Promise<void>(resolve => setImmediate(resolve)); // let the background prune finish
    expect((await repo.list()).map(record => record.data.value)).toEqual([3, 2]);
    await NativeStorageModule.insertRecord('speed-result', 4000, '{"value":"bad"}');
    await NativeStorageModule.insertRecord('speed-result', 5000, 'not json');
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect((await repo.list()).map(record => record.data.value)).toEqual([3, 2]);
    const [newest] = await repo.list();
    await repo.update(newest!.id, { value: 30 });
    expect((await repo.list())[0]?.data.value).toBe(30);
    await repo.clear();
    expect(await repo.list()).toEqual([]);
  });

  it('persists and restores settings', async () => {
    useSettingsStore.getState().setLanguagePreference('bg');
    useSettingsStore.getState().setThemePreference('dark');
    await Promise.resolve();
    useSettingsStore.setState({ languagePreference: 'system', themePreference: 'system' });
    await hydrateSettings();
    expect(useSettingsStore.getState()).toMatchObject({
      languagePreference: 'bg',
      themePreference: 'dark',
    });
  });

  it('ignores unknown saved settings', async () => {
    await NativeStorageModule.setSetting('theme', 'purple');
    useSettingsStore.setState({ themePreference: 'light' });
    await hydrateSettings();
    expect(useSettingsStore.getState().themePreference).toBe('light');
  });
});

describe('reports', () => {
  it('fills templates', () => {
    expect(fillTemplate('Signal is {rssi} dBm ({x})', { rssi: -70 })).toBe(
      'Signal is -70 dBm ({x})',
    );
  });
});
