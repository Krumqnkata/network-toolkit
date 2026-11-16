import { act, render, screen, userEvent } from '@testing-library/react-native';
import React from 'react';
import { Share } from 'react-native';

import { App } from '../src/app/App';
import { monitorSessions } from '../src/database/repositories';
import NativeNetToolsModule from '../src/native/specs/NativeNetToolsModule';
import NativeNetworkModule from '../src/native/specs/NativeNetworkModule';
import { useMonitorStore } from '../src/stores/monitorStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { wifiSnapshot } from './fixtures/networkSnapshot';

const tools = NativeNetToolsModule as jest.Mocked<typeof NativeNetToolsModule>;
const network = NativeNetworkModule as jest.Mocked<typeof NativeNetworkModule>;

const probe = (rttMs: number | null, address = '1.1.1.1') => ({
  address,
  family: 'ipv4',
  method: 'icmp',
  status: rttMs === null ? 'timeout' : 'reply',
  rttMs,
  ttl: rttMs === null ? null : 57,
  from: rttMs === null ? null : address,
});

async function openTool(name: RegExp) {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(screen.getByRole('button', { name: /^Tools/ }));
  await user.press(screen.getByRole('button', { name }));
  return user;
}

describe('Connection Monitor', () => {
  const initial = { settings: useSettingsStore.getState(), monitor: useMonitorStore.getState() };

  beforeEach(() => {
    useSettingsStore.setState(initial.settings, true);
    useMonitorStore.setState(initial.monitor, true);
    network.getNetworkSnapshot.mockResolvedValue(wifiSnapshot);
    tools.ping.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('tracks latency, loss and outages and saves the session', async () => {
    tools.ping
      .mockResolvedValueOnce(probe(10))
      .mockResolvedValueOnce(probe(null))
      .mockResolvedValueOnce(probe(null))
      .mockResolvedValueOnce(probe(null))
      .mockResolvedValue(probe(20));
    const user = await openTool(/^Connection Monitor/);

    await user.press(screen.getByTestId('monitor-start'));
    await act(() => jest.advanceTimersByTimeAsync(10_500));

    expect(tools.ping).toHaveBeenCalledWith('1.1.1.1', 'any', 0, 1500);
    expect(screen.getByTestId('monitor-current')).toHaveTextContent(/20\.0 ms/);
    expect(screen.getByTestId('monitor-loss')).toHaveTextContent(/50% \(3\/6\)/);
    expect(screen.getByText('Outages (1)')).toBeOnTheScreen();

    await user.press(screen.getByTestId('monitor-stop'));
    await act(() => jest.advanceTimersByTimeAsync(2500));

    const [saved] = await monitorSessions.list();
    expect(saved?.data).toMatchObject({ target: '1.1.1.1', sent: 6, received: 3 });
    expect(saved?.data.endedAt).not.toBeNull();
    expect(saved?.data.outages).toHaveLength(1);
    expect(await screen.findByText('Past sessions')).toBeOnTheScreen();

    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await user.press(screen.getByRole('button', { name: 'Share' }));
    expect(share.mock.calls[0]?.[0]).toMatchObject({
      message: expect.stringContaining('Outages: 1'),
    });
  });

  it('monitors the gateway', async () => {
    tools.ping.mockResolvedValue(probe(2, '192.168.1.1'));
    const user = await openTool(/^Connection Monitor/);

    await user.press(screen.getByRole('radio', { name: 'Gateway' }));
    await user.press(screen.getByTestId('monitor-start'));
    await act(() => jest.advanceTimersByTimeAsync(100));

    expect(tools.ping).toHaveBeenCalledWith('192.168.1.1', 'any', 0, 1500);
    await user.press(screen.getByTestId('monitor-stop'));
    await act(() => jest.advanceTimersByTimeAsync(2500));
  });

  it('stops with an error for an unknown host', async () => {
    tools.ping.mockRejectedValue(
      Object.assign(new Error('nowhere.invalid'), { code: 'E_UNKNOWN_HOST' }),
    );
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const user = await openTool(/^Connection Monitor/);

    await user.press(screen.getByRole('radio', { name: 'Custom' }));
    await user.type(screen.getByTestId('monitor-host'), 'nowhere.invalid');
    await user.press(screen.getByTestId('monitor-start'));
    await act(() => jest.advanceTimersByTimeAsync(100));

    expect(screen.getByTestId('tool-error')).toHaveTextContent(/Host not found/);
    expect(screen.getByTestId('monitor-start')).toBeOnTheScreen();
  });
});

describe('Health Check', () => {
  const initialSettings = useSettingsStore.getState();

  beforeEach(() => {
    useSettingsStore.setState(initialSettings, true);
    network.getNetworkSnapshot.mockResolvedValue({
      ...wifiSnapshot,
      wifi: { ...wifiSnapshot.wifi!, rssi: -80 },
    });
    tools.ping.mockReset().mockResolvedValue(probe(2, '192.168.1.1'));
    tools.dnsQuery.mockReset().mockResolvedValue({
      server: 'system',
      durationMs: 300,
      rcode: 0,
      authoritative: false,
      truncated: false,
      answers: [{ name: 'example.com', type: 1, ttl: 60, data: '93.184.216.34' }],
      authority: [],
    });
    tools.tcpConnect.mockReset().mockImplementation(async (host, _port, family) => ({
      address: host,
      family: family === 'ipv6' ? 'ipv6' : 'ipv4',
      status: 'open',
      connectMs: 15,
      message: null,
    }));
    tools.httpRequest.mockReset().mockImplementation(async url => ({
      hops: [
        {
          url,
          status: 204,
          statusText: '',
          protocol: 'http/1.1',
          cipherSuite: null,
          durationMs: 40,
          headers: [],
        },
      ],
    }));
  });

  afterEach(() => jest.restoreAllMocks());

  it('explains the findings, saves the report and shares it', async () => {
    const user = await openTool(/^Health Check/);

    await user.press(screen.getByTestId('health-run'));

    expect(await screen.findByTestId('finding-weak-signal')).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Problem: Weak Wi-Fi signal\. Signal is -80 dBm\./),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Warning: Slow DNS\. A lookup took 300 ms\./)).toBeOnTheScreen();
    expect(screen.queryByTestId('finding-all-good')).toBeNull();

    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await user.press(screen.getByTestId('health-share'));
    const message = share.mock.calls[0]?.[0] as { message: string };
    expect(message.message).toContain('Network Toolkit — health report');
    expect(message.message).toContain('[Problem] Weak Wi-Fi signal');
    await user.press(screen.getByTestId('health-share-json'));
    const json = JSON.parse((share.mock.calls[1]?.[0] as { message: string }).message);
    expect(json.findings[0]).toMatchObject({ id: 'weak-signal', severity: 'problem' });

    await act(async () => {
      await new Promise<void>(resolve => setTimeout(resolve, 600));
    });
    expect(screen.getByText('Previous reports')).toBeOnTheScreen();
    expect(screen.getByText('1 problem · 1 warning')).toBeOnTheScreen();
  });

  it('shows where the problem is along the connection', async () => {
    network.getNetworkSnapshot.mockResolvedValue(wifiSnapshot);
    // Router fast, provider's first router slow: the provider line is to blame.
    tools.ping.mockImplementation(async (host, _family, ttl) => {
      if (host === '1.1.1.1' && ttl === 1) {
        return { ...probe(null), status: 'ttl-exceeded', from: '192.168.1.1' };
      }
      if (host === '1.1.1.1' && ttl === 2) {
        return { ...probe(null), status: 'ttl-exceeded', from: '100.64.0.1' };
      }
      if (host === '100.64.0.1') return probe(140, host);
      if (host === '1.1.1.1') return probe(150, host);
      return probe(3, host);
    });
    const user = await openTool(/^Health Check/);

    await user.press(screen.getByTestId('health-run'));

    expect(await screen.findByTestId('segment-chain')).toBeOnTheScreen();
    expect(screen.getByTestId('locator-verdict')).toHaveTextContent(
      'The problem is the line between your router and your provider.',
    );
    expect(screen.getByTestId('chain-node-provider')).toHaveTextContent(/100\.64\.0\.1/);
    expect(screen.getByTestId('chain-link-local')).toHaveTextContent('Wi-Fi+3 ms');
    expect(screen.getByTestId('chain-link-access')).toHaveTextContent('Provider line+137 ms');

    const share = jest
      .spyOn(Share, 'share')
      .mockResolvedValue({ action: 'sharedAction', activityType: undefined });
    await user.press(screen.getByTestId('health-share'));
    const message = (share.mock.calls[0]?.[0] as { message: string }).message;
    expect(message).toContain('Where is the problem? The problem is the line between');
    expect(message).toContain('Provider line: +137 ms');
  });
});
