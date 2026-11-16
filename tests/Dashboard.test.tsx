import { act, render, screen, userEvent, within } from '@testing-library/react-native';
import React from 'react';
import { PermissionsAndroid } from 'react-native';

import { App } from '../src/app/App';
import { speedResults } from '../src/database/repositories';
import { homeProbes } from '../src/features/dashboard/services/homeData';
import { healthReports } from '../src/features/health-check/services/healthCheck';
import NativeNetToolsModule from '../src/native/specs/NativeNetToolsModule';
import NativeNetworkModule from '../src/native/specs/NativeNetworkModule';
import { useHomeStore } from '../src/stores/homeStore';
import { usePermissionStore } from '../src/stores/permissionStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import {
  cellularSnapshot,
  offlineSnapshot,
  redactedWifiSnapshot,
  wifiSnapshot,
} from './fixtures/networkSnapshot';
import { doneResult } from './fixtures/speed';

const mockedGetSnapshot = NativeNetworkModule.getNetworkSnapshot as jest.MockedFunction<
  typeof NativeNetworkModule.getNetworkSnapshot
>;
const tools = NativeNetToolsModule as jest.Mocked<typeof NativeNetToolsModule>;

const RTT: Record<string, number> = {
  'google.com': 18,
  'youtube.com': 24,
  'cloudflare.com': 9,
  '192.168.1.1': 3,
};

describe('Home', () => {
  const initial = {
    settings: useSettingsStore.getState(),
    permissions: usePermissionStore.getState(),
    home: useHomeStore.getState(),
  };
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useSettingsStore.setState(initial.settings, true);
    usePermissionStore.setState(initial.permissions, true);
    useHomeStore.setState(initial.home, true);
    mockedGetSnapshot.mockReset();
    tools.ping.mockReset().mockImplementation(async host => ({
      address: host,
      family: 'ipv4',
      method: 'icmp',
      status: 'reply',
      rttMs: RTT[host] ?? 50,
      ttl: 57,
      from: host,
    }));
    tools.dnsQuery.mockReset().mockImplementation(async name => ({
      server: 'system',
      durationMs: 3,
      rcode: 0,
      authoritative: false,
      truncated: false,
      answers: name.endsWith('.origin.asn.cymru.com')
        ? [{ name, type: 16, ttl: 60, data: '"8866 | 95.42.0.0/16 | BG | ripencc | 2001-01-01"' }]
        : name === 'AS8866.asn.cymru.com'
        ? [{ name, type: 16, ttl: 60, data: '"8866 | BG | ripencc | 2001-01-01 | BTC-AS, BG"' }]
        : [],
      authority: [],
    }));
    globalThis.fetch = jest.fn(async (url: string) => ({
      ok: true,
      status: 200,
      text: async () =>
        url.includes('cdn-cgi/trace') && !url.includes('[') ? 'ip=95.42.85.223\nloc=BG' : '[]',
    })) as unknown as typeof fetch;
    homeProbes.enabled = true;
    jest.useFakeTimers();
  });

  afterEach(() => {
    homeProbes.enabled = false;
    globalThis.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the connection diagram, a plain summary and what affects speed on Wi-Fi', async () => {
    mockedGetSnapshot.mockResolvedValue(wifiSnapshot);
    await render(<App />);

    expect(await screen.findByRole('header', { name: 'Home Network' })).toBeOnTheScreen();
    expect(await screen.findByText('BTC-AS')).toBeOnTheScreen();
    expect(
      within(screen.getByTestId('diagram-provider')).getByText('95.42.85.223'),
    ).toBeOnTheScreen();
    expect(screen.getByText('Online')).toBeOnTheScreen();
    expect(screen.getByText('Pixel 9')).toBeOnTheScreen();
    expect(screen.getByText('192.168.1.23')).toBeOnTheScreen();
    expect(screen.getByTestId('internet-status')).toHaveTextContent(
      'Your internet is working well.',
    );
    expect(screen.getByLabelText('Network: Home Network')).toBeOnTheScreen();
    expect(screen.getByLabelText('Band: 5 GHz')).toBeOnTheScreen();
    expect(screen.getByLabelText('Signal: -58 dBm')).toBeOnTheScreen();
    expect(screen.getByLabelText('Google: 18 ms')).toBeOnTheScreen();
    expect(screen.getByLabelText('Router: 3 ms')).toBeOnTheScreen();
    // Technical details are hidden until asked for.
    expect(screen.queryByLabelText('Gateway: 192.168.1.1')).not.toBeOnTheScreen();
  });

  it('shows the operator, 5G and signal on mobile data', async () => {
    mockedGetSnapshot.mockResolvedValue(cellularSnapshot);
    await render(<App />);

    expect(await screen.findByRole('header', { name: 'Mobile data' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Operator: VIVACOM')).toBeOnTheScreen();
    expect(screen.getByLabelText('Standard: 5G')).toBeOnTheScreen();
    expect(screen.getByLabelText('Signal: -84 dBm')).toBeOnTheScreen();
    expect(screen.getByText('Excellent')).toBeOnTheScreen();
    // Mobile data has no router to measure.
    expect(screen.queryByTestId('latency-gateway')).not.toBeOnTheScreen();
    expect(screen.getByLabelText('Google: 18 ms')).toBeOnTheScreen();
  });

  it('opens technical details on request', async () => {
    const user = userEvent.setup();
    mockedGetSnapshot.mockResolvedValue(wifiSnapshot);
    await render(<App />);

    await user.press(await screen.findByTestId('toggle-technical'));

    expect(screen.getByLabelText('Channel: 36')).toBeOnTheScreen();
    expect(screen.getByLabelText('Security: WPA3 Personal')).toBeOnTheScreen();
    expect(screen.getByLabelText('IPv4 address: 192.168.1.23/24')).toBeOnTheScreen();
    expect(screen.getByLabelText('Gateway: 192.168.1.1')).toBeOnTheScreen();
    expect(screen.getByLabelText('DNS servers: 192.168.1.1, 1.1.1.1')).toBeOnTheScreen();
    expect(screen.getByLabelText('IPv6 address: 2001:db8::23/64')).toBeOnTheScreen();
    expect(screen.queryByText(/fe80::/)).not.toBeOnTheScreen();
  });

  it('keeps the signal up to date while visible', async () => {
    mockedGetSnapshot.mockResolvedValue(wifiSnapshot);
    await render(<App />);
    await screen.findByLabelText('Signal: -58 dBm');

    mockedGetSnapshot.mockResolvedValue({
      ...wifiSnapshot,
      wifi: { ...wifiSnapshot.wifi!, rssi: -82 },
    });
    await act(() => jest.advanceTimersByTimeAsync(3000));

    expect(await screen.findByLabelText('Signal: -82 dBm')).toBeOnTheScreen();
    expect(screen.getByTestId('internet-status')).toHaveTextContent(/signal is weak/);
  });

  it('shows the latest speed test with what it is good for, and starts a new one', async () => {
    const user = userEvent.setup();
    mockedGetSnapshot.mockResolvedValue(wifiSnapshot);
    await speedResults.add({ ...doneResult, downloadMbps: 245.6, uploadMbps: 48.2 });
    await healthReports.add({
      createdAt: 1,
      transport: 'wifi',
      ssid: 'Home Network',
      findings: [
        { id: 'weak-signal', severity: 'problem', values: { rssi: -80 } },
        { id: 'dns-slow', severity: 'warning', values: { ms: 300 } },
      ],
      checks: [],
    });
    await render(<App />);

    expect(await screen.findByTestId('home-download')).toHaveTextContent('246');
    expect(screen.getByTestId('home-upload')).toHaveTextContent('48.2');
    expect(screen.getByTestId('home-speed-use')).toHaveTextContent(
      'Fast enough for everything, on many devices',
    );
    expect(screen.getByTestId('home-health')).toHaveTextContent(/1 problem, 1 warning/);

    await user.press(screen.getByTestId('home-run-speed'));
    expect(await screen.findByRole('header', { name: 'Speed Test' })).toBeOnTheScreen();
  });

  it('explains and requests location access when Android hides the SSID', async () => {
    const user = userEvent.setup();
    mockedGetSnapshot.mockResolvedValue(redactedWifiSnapshot);
    const request = jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: PermissionsAndroid.RESULTS.GRANTED,
    } as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);
    await render(<App />);

    expect(await screen.findByText('Show the network name')).toBeOnTheScreen();

    mockedGetSnapshot.mockResolvedValue(wifiSnapshot);
    await user.press(screen.getByRole('button', { name: 'Allow access' }));

    expect(request).toHaveBeenCalled();
    expect(await screen.findByLabelText('Network: Home Network')).toBeOnTheScreen();
    expect(screen.queryByText('Show the network name')).not.toBeOnTheScreen();
    expect(usePermissionStore.getState().location).toBe('granted');
  });

  it('offers the app settings after a permanent denial', async () => {
    const user = userEvent.setup();
    mockedGetSnapshot.mockResolvedValue(redactedWifiSnapshot);
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]:
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
      [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]:
        PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
    } as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);
    await render(<App />);

    await user.press(await screen.findByRole('button', { name: 'Allow access' }));

    expect(await screen.findByRole('button', { name: 'Open app settings' })).toBeOnTheScreen();
    expect(usePermissionStore.getState().location).toBe('blocked');
  });

  it('shows a clear state without a network', async () => {
    mockedGetSnapshot.mockResolvedValue(offlineSnapshot);
    await render(<App />);

    expect(await screen.findByRole('header', { name: 'No connection' })).toBeOnTheScreen();
    expect(screen.getByTestId('internet-status')).toHaveTextContent(
      'You are not connected to any network.',
    );
    expect(screen.queryByTestId('factors-card')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('toggle-technical')).not.toBeOnTheScreen();
    expect(tools.ping).not.toHaveBeenCalled();
  });

  it('shows an error with retry when the native call fails', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const user = userEvent.setup();
    mockedGetSnapshot.mockRejectedValue(
      Object.assign(new Error('ConnectivityManager unavailable'), { code: 'E_NETWORK' }),
    );
    await render(<App />);

    expect(await screen.findByText('Could not read the network state')).toBeOnTheScreen();

    mockedGetSnapshot.mockResolvedValue(wifiSnapshot);
    await user.press(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('header', { name: 'Home Network' })).toBeOnTheScreen();
  });

  it('renders in Bulgarian', async () => {
    useSettingsStore.setState({ languagePreference: 'bg' });
    mockedGetSnapshot.mockResolvedValue(cellularSnapshot);
    await render(<App />);

    expect(await screen.findByRole('header', { name: 'Мобилни данни' })).toBeOnTheScreen();
    expect(screen.getByTestId('internet-status')).toHaveTextContent('Интернетът ти работи добре.');
    expect(screen.getByLabelText('Оператор: VIVACOM')).toBeOnTheScreen();
    expect(screen.getByText('Тест на скоростта')).toBeOnTheScreen();
  });
});
