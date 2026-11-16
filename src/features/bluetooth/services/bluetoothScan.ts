import {
  getBleScanResults,
  getBluetoothState,
  getBondedDevices,
  startBleScan,
  stopBleScan,
} from '../../../native/bluetooth';
import { requestBluetoothPermission } from '../../../services/permissions/bluetoothPermission';
import { useBluetoothStore } from '../../../stores/bluetoothStore';
import { logError, toAppError } from '../../../utils/errors';

export const POLL_MS = 1000;
/** Scans stop on their own after this long to save battery. */
export const MAX_SCAN_MS = 2 * 60_000;

const store = () => useBluetoothStore.getState();
let timer: ReturnType<typeof setInterval> | null = null;

function stopPolling() {
  if (timer) clearInterval(timer);
  timer = null;
}

export async function refreshBluetoothState(): Promise<void> {
  try {
    const state = await getBluetoothState();
    store().set({ state, permission: state.scanPermission ? 'granted' : store().permission });
    if (state.connectPermission) {
      store().set({ bonded: await getBondedDevices() });
    }
  } catch (error) {
    logError('bluetooth', error);
    store().set({ error: toAppError(error) });
  }
}

export async function requestPermission(): Promise<void> {
  const result = await requestBluetoothPermission();
  store().set({ permission: result });
  await refreshBluetoothState();
}

async function poll() {
  try {
    const results = await getBleScanResults();
    store().set({
      devices: results.devices,
      scanError: results.error,
      scanning: results.scanning,
    });
    if (!results.scanning || results.elapsedMs >= MAX_SCAN_MS) await stopScan();
  } catch (error) {
    logError('bluetooth', error);
    await stopScan();
  }
}

export async function startScan(): Promise<void> {
  store().set({ error: null, scanError: null });
  try {
    await startBleScan();
    store().set({ scanning: true, devices: [] });
    stopPolling();
    timer = setInterval(poll, POLL_MS);
  } catch (error) {
    logError('bluetooth', error);
    store().set({ scanning: false, error: toAppError(error) });
    await refreshBluetoothState();
  }
}

export async function stopScan(): Promise<void> {
  stopPolling();
  store().set({ scanning: false });
  try {
    await stopBleScan();
  } catch (error) {
    logError('bluetooth', error);
  }
}
