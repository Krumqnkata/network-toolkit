import { z } from 'zod';

import { toAppError } from '../utils/errors';
import { parseNative } from './netTools';
import NativeBluetoothModule from './specs/NativeBluetoothModule';

export const bluetoothStateSchema = z.object({
  supported: z.boolean(),
  enabled: z.boolean(),
  scanPermission: z.boolean(),
  connectPermission: z.boolean(),
  /** Android 8–11: scanning needs precise location and location services. */
  needsLocation: z.boolean(),
  locationEnabled: z.boolean(),
  scanning: z.boolean(),
});
export type BluetoothState = z.infer<typeof bluetoothStateSchema>;

export const bleDeviceSchema = z.object({
  address: z.string(),
  name: z.string().nullable(),
  rssi: z.number().int(),
  txPower: z.number().int().nullable(),
  connectable: z.boolean(),
  manufacturerIds: z.array(z.number().int()),
  serviceUuids: z.array(z.number().int()),
  ageMs: z.number().nonnegative(),
  seenForMs: z.number().nonnegative(),
  history: z.array(z.number().int()),
});
export type BleDevice = z.infer<typeof bleDeviceSchema>;

export const scanResultsSchema = z.object({
  scanning: z.boolean(),
  error: z.string().nullable(),
  elapsedMs: z.number().nonnegative(),
  devices: z.array(bleDeviceSchema),
});
export type BleScanResults = z.infer<typeof scanResultsSchema>;

export const bondedDeviceSchema = z.object({
  address: z.string(),
  name: z.string().nullable(),
  type: z.enum(['classic', 'le', 'dual', 'unknown']),
  majorClass: z.number().int(),
});
export type BondedDevice = z.infer<typeof bondedDeviceSchema>;

async function native<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getBluetoothState(): Promise<BluetoothState> {
  return parseNative(
    bluetoothStateSchema,
    await native(() => NativeBluetoothModule.getState()),
    'Bluetooth state',
  );
}

export function startBleScan(): Promise<void> {
  return native(() => NativeBluetoothModule.startScan());
}

export function stopBleScan(): Promise<void> {
  return native(() => NativeBluetoothModule.stopScan());
}

export async function getBleScanResults(): Promise<BleScanResults> {
  return parseNative(
    scanResultsSchema,
    await native(() => NativeBluetoothModule.getScanResults()),
    'Bluetooth scan',
  );
}

export async function getBondedDevices(): Promise<BondedDevice[]> {
  return parseNative(
    z.array(bondedDeviceSchema),
    await native(() => NativeBluetoothModule.getBondedDevices()),
    'paired devices',
  );
}
