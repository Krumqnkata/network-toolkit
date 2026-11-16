import { act, render, screen, userEvent } from '@testing-library/react-native';
import React from 'react';

import { App } from '../src/app/App';
import {
  bloatLevel,
  formatBytes,
  formatMbps,
  gaugeFraction,
  latencyIncrease,
} from '../src/domain/algorithms/speed';
import NativeNetworkModule from '../src/native/specs/NativeNetworkModule';
import NativeSpeedTestModule from '../src/native/specs/NativeSpeedTestModule';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useSpeedTestStore } from '../src/stores/speedTestStore';
import { wifiSnapshot } from './fixtures/networkSnapshot';

const speed = NativeSpeedTestModule as jest.Mocked<typeof NativeSpeedTestModule>;
const network = NativeNetworkModule as jest.Mocked<typeof NativeNetworkModule>;

const status = (overrides: Record<string, unknown> = {}) => ({
  phase: 'idle',
  progress: 0,
  currentMbps: null,
  downloadMbps: null,
  uploadMbps: null,
  idleLatencyMs: null,
  jitterMs: null,
  downloadLatencyMs: null,
  uploadLatencyMs: null,
  packetLossPercent: null,
  bytesDownloaded: 0,
  bytesUploaded: 0,
  serverColo: null,
  serverCity: null,
  serverCountry: null,
  error: null,
  ...overrides,
});

const finished = status({
  phase: 'done',
  progress: 1,
  downloadMbps: 245.6,
  uploadMbps: 48.2,
  idleLatencyMs: 12.4,
  jitterMs: 1.8,
  downloadLatencyMs: 58,
  uploadLatencyMs: 140,
  packetLossPercent: 0,
  bytesDownloaded: 310_000_000,
  bytesUploaded: 60_000_000,
  serverColo: 'SOF',
  serverCity: 'Sofia',
  serverCountry: 'BG',
});

async function openSpeedTest() {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(screen.getByRole('button', { name: /^Tools/ }));
  await user.press(screen.getByRole('button', { name: /^Speed Test/ }));
  return user;
}

describe('speed math', () => {
  it('formats rates and data', () => {
    expect(formatMbps(null)).toBe('—');
    expect(formatMbps(48.25)).toBe('48.3');
    expect(formatMbps(245.6)).toBe('246');
    expect(formatBytes(850_000)).toBe('850 kB');
    expect(formatBytes(370_000_000)).toBe('370 MB');
    expect(formatBytes(1_250_000_000)).toBe('1.3 GB');
  });

  it('maps rates onto the gauge and rates bufferbloat', () => {
    expect(gaugeFraction(null)).toBe(0);
    expect(gaugeFraction(250)).toBeCloseTo(0.5);
    expect(gaugeFraction(5000)).toBe(1);
    expect(latencyIncrease(12, 58)).toBe(46);
    expect(latencyIncrease(12, null)).toBeNull();
    expect(bloatLevel(10)).toBe('low');
    expect(bloatLevel(46)).toBe('moderate');
    expect(bloatLevel(150)).toBe('high');
    expect(bloatLevel(null)).toBeNull();
  });
});

describe('Speed Test screen', () => {
  const initial = { settings: useSettingsStore.getState(), speed: useSpeedTestStore.getState() };

  beforeEach(() => {
    useSettingsStore.setState(initial.settings, true);
    useSpeedTestStore.setState(initial.speed, true);
    network.getNetworkSnapshot.mockResolvedValue(wifiSnapshot);
    speed.start.mockReset().mockResolvedValue(status({ phase: 'latency' }));
    speed.getStatus.mockReset().mockResolvedValue(status());
    speed.cancel.mockClear();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('runs a test, shows live speed and the final results', async () => {
    const user = await openSpeedTest();
    speed.getStatus
      .mockResolvedValueOnce(status({ phase: 'download', progress: 0.3, currentMbps: 180.4 }))
      .mockResolvedValue(finished);

    await user.press(screen.getByTestId('speed-start'));
    expect(speed.start).toHaveBeenCalledWith(10, 4);

    await act(() => jest.advanceTimersByTimeAsync(250));
    expect(screen.getByTestId('speed-value')).toHaveTextContent('180');
    expect(screen.getByTestId('speed-stop')).toBeOnTheScreen();

    await act(() => jest.advanceTimersByTimeAsync(250));
    expect(screen.getByLabelText('Download: 246 Mbps')).toBeOnTheScreen();
    expect(screen.getByLabelText('Upload: 48.2 Mbps')).toBeOnTheScreen();
    expect(screen.getByLabelText('Ping: 12.4 ms')).toBeOnTheScreen();
    expect(screen.getByText('High bufferbloat')).toBeOnTheScreen();
    expect(screen.getByLabelText('During download: 58.0 ms (+45.6 ms)')).toBeOnTheScreen();
    expect(screen.getByLabelText('Server: SOF · Sofia · BG')).toBeOnTheScreen();
    expect(screen.getByLabelText('Data used: 370 MB')).toBeOnTheScreen();
    expect(screen.getByTestId('speed-start')).toHaveTextContent('Test again');
    expect(useSpeedTestStore.getState().results).toHaveLength(1);

    // Polling stops once the test is over.
    const calls = speed.getStatus.mock.calls.length;
    await act(() => jest.advanceTimersByTimeAsync(2000));
    expect(speed.getStatus).toHaveBeenCalledTimes(calls);
  });

  it('asks before testing on a metered network', async () => {
    network.getNetworkSnapshot.mockResolvedValue({ ...wifiSnapshot, isMetered: true });
    const user = await openSpeedTest();

    await user.press(screen.getByTestId('speed-start'));
    expect(speed.start).not.toHaveBeenCalled();
    expect(screen.getByText('Metered connection')).toBeOnTheScreen();

    await user.press(screen.getByTestId('speed-run-anyway'));
    expect(speed.start).toHaveBeenCalledTimes(1);
  });

  it('stops a running test and reports native errors', async () => {
    const user = await openSpeedTest();
    speed.getStatus.mockResolvedValue(status({ phase: 'upload', progress: 0.7, currentMbps: 30 }));

    await user.press(screen.getByTestId('speed-start'));
    await act(() => jest.advanceTimersByTimeAsync(250));
    await user.press(screen.getByTestId('speed-stop'));
    expect(speed.cancel).toHaveBeenCalled();

    speed.getStatus.mockResolvedValue(status({ phase: 'error', error: 'timeout' }));
    await act(() => jest.advanceTimersByTimeAsync(250));
    expect(screen.getByTestId('speed-error')).toHaveTextContent('Test failed: timeout');
  });

  it('shows when packet loss could not be measured', async () => {
    const user = await openSpeedTest();
    speed.getStatus.mockResolvedValue({ ...finished, packetLossPercent: null });

    await user.press(screen.getByTestId('speed-start'));
    await act(() => jest.advanceTimersByTimeAsync(250));

    expect(screen.getByTestId('speed-loss')).toHaveTextContent(/Not measured/);
  });
});
