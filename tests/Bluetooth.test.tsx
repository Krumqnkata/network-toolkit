import { act, render, screen, userEvent } from '@testing-library/react-native';
import React from 'react';
import { PermissionsAndroid, Platform } from 'react-native';

import { App } from '../src/app/App';
import {
  brandName,
  companyName,
  deviceMaker,
  estimateDistance,
  guessBluetoothKind,
  proximity,
  serviceName,
  signalTrend,
} from '../src/domain/algorithms/bluetooth';
import type { BleDevice } from '../src/native/bluetooth';
import NativeBluetoothModule from '../src/native/specs/NativeBluetoothModule';
import { useBluetoothStore } from '../src/stores/bluetoothStore';
import { useSettingsStore } from '../src/stores/settingsStore';

const bt = NativeBluetoothModule as jest.Mocked<typeof NativeBluetoothModule>;

const device = (overrides: Partial<BleDevice> = {}): BleDevice => ({
  address: 'AA:BB:CC:00:11:22',
  name: 'Galaxy Buds2 Pro',
  rssi: -52,
  txPower: null,
  connectable: true,
  manufacturerIds: [0x0075],
  serviceUuids: [],
  ageMs: 200,
  seenForMs: 3000,
  history: [-60, -59, -58, -55, -53, -52],
  ...overrides,
});

const state = (overrides: Record<string, unknown> = {}) => ({
  supported: true,
  enabled: true,
  scanPermission: true,
  connectPermission: true,
  needsLocation: false,
  locationEnabled: true,
  scanning: false,
  ...overrides,
});

describe('Bluetooth rules', () => {
  it('names companies, services and brands from the Bluetooth SIG lists', () => {
    expect(companyName(0x004c)).toBe('Apple, Inc.');
    expect(companyName(0x0075)).toBe('Samsung Electronics Co. Ltd.');
    expect(companyName(0xfffe)).toBeNull();
    expect(serviceName(0x180d)).toBe('Heart Rate');
    expect(serviceName(0xfe2c)).toBe('Google LLC');
    expect(brandName('HUAWEI Technologies Co., Ltd.')).toBe('HUAWEI');
    expect(brandName('Harman International Industries, Inc.')).toBe('Harman');
    expect(deviceMaker({ manufacturerIds: [0x004c], serviceUuids: [] })).toBe('Apple');
    expect(deviceMaker({ manufacturerIds: [], serviceUuids: [0xfe07] })).toBe('Sonos');
    expect(deviceMaker({ manufacturerIds: [], serviceUuids: [] })).toBeNull();
  });

  it('guesses the kind from the name, else from services', () => {
    expect(guessBluetoothKind({ name: 'AirPods Pro', serviceUuids: [] })).toBe('headphones');
    expect(guessBluetoothKind({ name: 'JBL Flip 6', serviceUuids: [] })).toBe('speaker');
    expect(guessBluetoothKind({ name: 'Galaxy Watch6', serviceUuids: [] })).toBe('watch');
    expect(guessBluetoothKind({ name: null, serviceUuids: [0x180d] })).toBe('fitness');
    expect(guessBluetoothKind({ name: null, serviceUuids: [0x1812] })).toBe('keyboard');
    expect(guessBluetoothKind({ name: 'XYZ-123', serviceUuids: [] })).toBe('unknown');
  });

  it('describes distance and trend in plain words', () => {
    expect(proximity(-50)).toBe('very-close');
    expect(proximity(-65)).toBe('near');
    expect(proximity(-80)).toBe('room');
    expect(proximity(-95)).toBe('far');
    expect(estimateDistance(-59, null)).toBe(1);
    expect(estimateDistance(-84, -59)).toBe(10);
    expect(estimateDistance(-130, null)).toBe(50);
    expect(signalTrend([-70, -70, -70, -62, -61, -60])).toBe('closer');
    expect(signalTrend([-60, -60, -60, -70, -70, -71])).toBe('farther');
    expect(signalTrend([-60, -61])).toBe('steady');
  });
});

describe('Bluetooth scanner', () => {
  const initial = { settings: useSettingsStore.getState(), bt: useBluetoothStore.getState() };

  beforeEach(() => {
    useSettingsStore.setState(initial.settings, true);
    useBluetoothStore.setState(initial.bt, true);
    bt.getState.mockReset().mockResolvedValue(state());
    bt.startScan.mockClear();
    bt.stopScan.mockClear();
    bt.getScanResults.mockReset().mockResolvedValue({
      scanning: true,
      error: null,
      elapsedMs: 1000,
      devices: [
        device(),
        device({
          address: 'DE:AD:BE:EF:00:01',
          name: null,
          rssi: -88,
          manufacturerIds: [0x004c],
          history: [-88],
        }),
      ],
    });
    bt.getBondedDevices
      .mockReset()
      .mockResolvedValue([
        { address: '11:22:33:44:55:66', name: 'Car Audio', type: 'classic', majorClass: 1024 },
      ]);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  async function openBluetooth() {
    const user = userEvent.setup();
    await render(<App />);
    await user.press(screen.getByRole('button', { name: /^Devices, tab/ }));
    await user.press(screen.getByRole('radio', { name: 'Bluetooth' }));
    return user;
  }

  it('finds nearby devices with maker, type and proximity, and lists paired ones', async () => {
    const user = await openBluetooth();

    await user.press(await screen.findByTestId('bt-scan'));
    await act(() => jest.advanceTimersByTimeAsync(1100));

    expect(bt.startScan).toHaveBeenCalled();
    expect(screen.getByText('2 devices nearby')).toBeOnTheScreen();
    expect(screen.getByTestId('bt-device-AA:BB:CC:00:11:22')).toHaveTextContent(
      /Galaxy Buds2 Pro.*Very close · Samsung · Headphones/,
    );
    expect(screen.getByTestId('bt-device-DE:AD:BE:EF:00:01')).toHaveTextContent(
      /Apple · Bluetooth device.*Far away/,
    );
    expect(screen.getByText('Car Audio')).toBeOnTheScreen();

    await user.press(screen.getByTestId('bt-stop'));
    expect(bt.stopScan).toHaveBeenCalled();
  });

  it('opens the finder with live signal and trend', async () => {
    const user = await openBluetooth();
    await user.press(await screen.findByTestId('bt-scan'));
    await act(() => jest.advanceTimersByTimeAsync(1100));

    await user.press(screen.getByTestId('bt-device-AA:BB:CC:00:11:22'));

    expect(await screen.findByText('Find this device')).toBeOnTheScreen();
    expect(screen.getByTestId('bt-finder')).toHaveTextContent(/-52.*Very close/);
    expect(screen.getByTestId('bt-trend')).toHaveTextContent('Getting closer');
    expect(screen.getByLabelText('Maker: Samsung')).toBeOnTheScreen();
  });

  it('asks for the Nearby devices permission on Android 12+', async () => {
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(34);
    bt.getState.mockResolvedValue(state({ scanPermission: false, connectPermission: false }));
    const request = jest
      .spyOn(PermissionsAndroid, 'requestMultiple')
      .mockImplementation(async () => {
        bt.getState.mockResolvedValue(state());
        return {
          [PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN]: PermissionsAndroid.RESULTS.GRANTED,
          [PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT]: PermissionsAndroid.RESULTS.GRANTED,
        } as Awaited<ReturnType<typeof PermissionsAndroid.requestMultiple>>;
      });
    const user = await openBluetooth();

    expect(await screen.findByText('Allow finding nearby devices')).toBeOnTheScreen();
    await user.press(screen.getByTestId('bt-allow'));

    expect(request).toHaveBeenCalledWith([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    ]);
    expect(await screen.findByTestId('bt-scan')).toBeOnTheScreen();
  });

  it('explains when Bluetooth is off', async () => {
    bt.getState.mockResolvedValue(state({ enabled: false }));
    await openBluetooth();

    expect(await screen.findByText('Bluetooth is turned off.')).toBeOnTheScreen();
    expect(screen.getByTestId('bt-open-settings')).toBeOnTheScreen();
    expect(screen.queryByTestId('bt-scan')).not.toBeOnTheScreen();
  });

  it('opens from the Tools list', async () => {
    const user = userEvent.setup();
    await render(<App />);
    await user.press(screen.getByRole('button', { name: /^Tools, tab/ }));
    await user.press(screen.getByRole('button', { name: /^Bluetooth Scanner/ }));

    expect(await screen.findByTestId('bt-scan')).toBeOnTheScreen();
  });
});
