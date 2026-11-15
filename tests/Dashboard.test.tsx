import { act, render, screen, userEvent } from '@testing-library/react-native';
import React from 'react';
import { PermissionsAndroid } from 'react-native';

import { App } from '../src/app/App';
import NativeNetworkModule from '../src/native/specs/NativeNetworkModule';
import { usePermissionStore } from '../src/stores/permissionStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { offlineSnapshot, redactedWifiSnapshot, wifiSnapshot } from './fixtures/networkSnapshot';

const mockedGetSnapshot = NativeNetworkModule.getNetworkSnapshot as jest.MockedFunction<
  typeof NativeNetworkModule.getNetworkSnapshot
>;

describe('Dashboard', () => {
  const initialSettings = useSettingsStore.getState();
  const initialPermissions = usePermissionStore.getState();

  beforeEach(() => {
    useSettingsStore.setState(initialSettings, true);
    usePermissionStore.setState(initialPermissions, true);
    mockedGetSnapshot.mockReset();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('shows the live connection details', async () => {
    mockedGetSnapshot.mockResolvedValue(wifiSnapshot);
    await render(<App />);

    expect(await screen.findByText('Home Network')).toBeOnTheScreen();
    expect(screen.getByRole('header', { name: 'Connected via Wi-Fi' })).toBeOnTheScreen();
    expect(screen.getByText('Internet OK')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Signal: -58 dBm, Good' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Channel: 36')).toBeOnTheScreen();
    expect(screen.getByLabelText('Band: 5 GHz')).toBeOnTheScreen();
    expect(screen.getByLabelText('Security: WPA3 Personal')).toBeOnTheScreen();
    expect(screen.getByLabelText('IPv4 address: 192.168.1.23/24')).toBeOnTheScreen();
    expect(screen.getByLabelText('Gateway: 192.168.1.1')).toBeOnTheScreen();
    expect(screen.getByLabelText('DNS servers: 192.168.1.1, 1.1.1.1')).toBeOnTheScreen();
    // Link-local IPv6 addresses are not shown.
    expect(screen.getByLabelText('IPv6 address: 2001:db8::23/64')).toBeOnTheScreen();
    expect(screen.queryByText(/fe80::/)).not.toBeOnTheScreen();
  });

  it('keeps polling while the dashboard is focused', async () => {
    mockedGetSnapshot.mockResolvedValue(wifiSnapshot);
    await render(<App />);
    await screen.findByText('Home Network');

    mockedGetSnapshot.mockResolvedValue({
      ...wifiSnapshot,
      wifi: { ...wifiSnapshot.wifi!, rssi: -82 },
    });
    await act(() => jest.advanceTimersByTimeAsync(3000));

    expect(
      await screen.findByRole('progressbar', { name: 'Signal: -82 dBm, Poor' }),
    ).toBeOnTheScreen();
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
    expect(screen.getByText('Not available')).toBeOnTheScreen();

    mockedGetSnapshot.mockResolvedValue(wifiSnapshot);
    await user.press(screen.getByRole('button', { name: 'Allow access' }));

    expect(request).toHaveBeenCalledWith([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);
    expect(await screen.findByText('Home Network')).toBeOnTheScreen();
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

    expect(await screen.findByRole('header', { name: 'Not connected' })).toBeOnTheScreen();
    expect(screen.queryByTestId('wifi-card')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('ip-card')).not.toBeOnTheScreen();
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

    expect(await screen.findByText('Home Network')).toBeOnTheScreen();
  });

  it('renders the dashboard in Bulgarian', async () => {
    useSettingsStore.setState({ languagePreference: 'bg' });
    mockedGetSnapshot.mockResolvedValue(wifiSnapshot);
    await render(<App />);

    expect(await screen.findByRole('header', { name: 'Свързан чрез Wi-Fi' })).toBeOnTheScreen();
    expect(screen.getByText('Има интернет')).toBeOnTheScreen();
    expect(screen.getByRole('progressbar', { name: 'Сигнал: -58 dBm, Добър' })).toBeOnTheScreen();
    expect(screen.getByLabelText('Канал: 36')).toBeOnTheScreen();
  });
});
