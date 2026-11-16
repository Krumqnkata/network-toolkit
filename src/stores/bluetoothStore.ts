import { create } from 'zustand';

import type { BleDevice, BluetoothState, BondedDevice } from '../native/bluetooth';
import type { AppError } from '../utils/errors';

interface BluetoothStoreState {
  state: BluetoothState | null;
  scanning: boolean;
  devices: BleDevice[];
  bonded: BondedDevice[];
  /** Native scan error code (`unsupported`, `registration-failed`, …). */
  scanError: string | null;
  error: AppError | null;
  permission: 'unknown' | 'granted' | 'denied' | 'blocked';
  set: (patch: Partial<Omit<BluetoothStoreState, 'set'>>) => void;
}

export const useBluetoothStore = create<BluetoothStoreState>()(set => ({
  state: null,
  scanning: false,
  devices: [],
  bonded: [],
  scanError: null,
  error: null,
  permission: 'unknown',
  set: patch => set(patch),
}));
