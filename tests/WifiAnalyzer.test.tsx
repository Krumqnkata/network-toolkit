import { act, render, screen, userEvent, within } from '@testing-library/react-native';
import React from 'react';
import { PermissionsAndroid } from 'react-native';

import { App } from '../src/app/App';
import NativeWifiModule from '../src/native/specs/NativeWifiModule';
import { usePermissionStore } from '../src/stores/permissionStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useWifiScanStore } from '../src/stores/wifiScanStore';
import { scanResult } from './fixtures/wifiScan';

const mockedScan = NativeWifiModule.scan as jest.MockedFunction<typeof NativeWifiModule.scan>;
const mockedCached = NativeWifiModule.getCachedScanResults as jest.MockedFunction<
  typeof NativeWifiModule.getCachedScanResults
>;

const permissionError = () =>
  Object.assign(new Error('Precise location permission is required'), { code: 'E_PERMISSION' });

async function openAnalyzer() {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(screen.getByRole('button', { name: /^Wi-Fi/ }));
  return user;
}

describe('Wi-Fi Analyzer', () => {
  const initial = {
    settings: useSettingsStore.getState(),
    permissions: usePermissionStore.getState(),
    scan: useWifiScanStore.getState(),
  };

  beforeEach(() => {
    useSettingsStore.setState(initial.settings, true);
    usePermissionStore.setState(initial.permissions, true);
    useWifiScanStore.setState(initial.scan, true);
    mockedScan.mockReset().mockResolvedValue(scanResult);
    mockedCached.mockReset().mockResolvedValue({ ...scanResult, fresh: false });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('lists 2.4 GHz networks strongest first with band counts', async () => {
    await openAnalyzer();

    expect(await screen.findByTestId('scan-summary')).toHaveTextContent(/^5 networks · /);
    const bands = screen.getByTestId('band-options');
    expect(within(bands).getByRole('radio', { name: '2.4 GHz (3)' })).toBeChecked();
    expect(within(bands).getByRole('radio', { name: '5 GHz (1)' })).toBeOnTheScreen();
    expect(within(bands).getByRole('radio', { name: '6 GHz (1)' })).toBeOnTheScreen();

    expect(
      screen.getByLabelText(
        /^Home Network, -48 dBm, Excellent, ch 6 · 20 MHz · 2437 MHz, WPA2 · WPS/,
      ),
    ).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Neighbour, -71 dBm, Weak, ch 1/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Hidden network, -83 dBm, Poor, ch 11/)).toBeOnTheScreen();
    expect(
      screen.getByRole('image', { name: /^Channel graph: 3 networks on 2.4 GHz/ }),
    ).toBeOnTheScreen();
  });

  it('switches bands and marks the connected access point', async () => {
    const user = await openAnalyzer();
    await screen.findByTestId('scan-summary');

    await user.press(screen.getByRole('radio', { name: '5 GHz (1)' }));

    expect(
      await screen.findByLabelText(/^Home Network, Connected, -58 dBm, Good, ch 36 · 80 MHz/),
    ).toBeOnTheScreen();
    expect(
      screen.getByLabelText(/^Your network: Channel 36 · 0 overlapping networks/),
    ).toBeOnTheScreen();
  });

  it('recommends the least used 2.4 GHz channel', async () => {
    await openAnalyzer();
    const card = await screen.findByTestId('channel-recommendations');
    const chips = within(card).getAllByLabelText(/^Channel \d+: /);
    // Fixture: -48 dBm on 6, -71 dBm on 1, -83 dBm on 11 → 11 is best, 6 is worst.
    expect(chips.map(chip => chip.props.accessibilityLabel)).toEqual([
      'Channel 11: Light',
      'Channel 1: Light',
      'Channel 6: Moderate',
    ]);
  });

  it('auto-scans every 30 seconds while visible', async () => {
    await openAnalyzer();
    await screen.findByTestId('scan-summary');
    const before = mockedScan.mock.calls.length;

    await act(() => jest.advanceTimersByTimeAsync(30_000));

    expect(mockedScan.mock.calls.length).toBe(before + 1);
  });

  it('explains Android throttling', async () => {
    mockedScan.mockResolvedValue({ ...scanResult, scanStarted: false, fresh: false });
    await openAnalyzer();

    expect(await screen.findByTestId('scan-throttled')).toHaveTextContent(
      'Android limited scanning — showing the most recent results.',
    );
  });

  it('asks for location access before scanning', async () => {
    mockedCached.mockRejectedValue(permissionError());
    mockedScan.mockRejectedValue(permissionError());
    jest.spyOn(PermissionsAndroid, 'requestMultiple').mockResolvedValue({
      [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION]: PermissionsAndroid.RESULTS.GRANTED,
      [PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION]: PermissionsAndroid.RESULTS.GRANTED,
    } as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>);
    const user = await openAnalyzer();

    expect(await screen.findByText('Allow Wi-Fi scanning')).toBeOnTheScreen();
    expect(screen.queryByTestId('scan-button')).not.toBeOnTheScreen();

    mockedScan.mockResolvedValue(scanResult);
    await user.press(screen.getByRole('button', { name: 'Allow access' }));

    expect(await screen.findByTestId('scan-summary')).toBeOnTheScreen();
    expect(screen.queryByText('Allow Wi-Fi scanning')).not.toBeOnTheScreen();
  });

  it('explains that location services are off', async () => {
    const off = { ...scanResult, locationEnabled: false, networks: [] };
    mockedCached.mockResolvedValue(off);
    mockedScan.mockResolvedValue(off);
    await openAnalyzer();

    expect(await screen.findByText('Location is turned off')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Open location settings' })).toBeOnTheScreen();
  });

  it('renders in Bulgarian', async () => {
    useSettingsStore.setState({ languagePreference: 'bg' });
    const user = userEvent.setup();
    await render(<App />);
    await user.press(screen.getByRole('button', { name: /^Wi-Fi/ }));

    expect(await screen.findByRole('header', { name: 'Wi-Fi анализатор' })).toBeOnTheScreen();
    expect(await screen.findByTestId('scan-summary')).toHaveTextContent(/^5 мрежи · /);
    expect(screen.getByText('Най-добри канали')).toBeOnTheScreen();
  });
});
