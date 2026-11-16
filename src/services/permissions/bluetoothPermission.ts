import { Linking, PermissionsAndroid, Platform } from 'react-native';

import type { PermissionState } from '../../stores/permissionStore';
import { logError } from '../../utils/errors';
import { requestPreciseLocation } from './locationPermission';

/**
 * Bluetooth scanning permission. Android 12+ has its own "Nearby devices"
 * permissions (BLUETOOTH_SCAN, BLUETOOTH_CONNECT); older versions need precise
 * location instead.
 */
export async function requestBluetoothPermission(): Promise<PermissionState> {
  // The app is Android-only; API level 31 is Android 12.
  if (Number(Platform.Version) < 31) {
    return requestPreciseLocation();
  }
  const SCAN = PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN;
  const CONNECT = PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT;
  try {
    const result = await PermissionsAndroid.requestMultiple([SCAN, CONNECT]);
    if (result[SCAN] === PermissionsAndroid.RESULTS.GRANTED) return 'granted';
    if (result[SCAN] === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) return 'blocked';
    return 'denied';
  } catch (error) {
    logError('permissions', error);
    return 'denied';
  }
}

export function openBluetoothSettings(): Promise<void> {
  return Linking.sendIntent('android.settings.BLUETOOTH_SETTINGS').catch(error => {
    logError('permissions', error);
    return Linking.openSettings();
  });
}
