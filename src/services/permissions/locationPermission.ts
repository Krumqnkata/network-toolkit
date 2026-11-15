import { Linking, PermissionsAndroid } from 'react-native';

import { usePermissionStore, type PermissionState } from '../../stores/permissionStore';
import { logError } from '../../utils/errors';

const FINE = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
const COARSE = PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

/**
 * Requests precise location, which Android requires to reveal Wi-Fi SSIDs,
 * BSSIDs and (on Android 8–12) scan results. Since Android 12, fine and coarse
 * location must be requested together; only "precise" counts as granted here.
 */
export async function requestPreciseLocation(): Promise<PermissionState> {
  let state: PermissionState;
  try {
    const result = await PermissionsAndroid.requestMultiple([FINE, COARSE]);
    const fine = result[FINE];
    if (fine === PermissionsAndroid.RESULTS.GRANTED) {
      state = 'granted';
    } else if (fine === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      state = 'blocked';
    } else {
      state = 'denied';
    }
  } catch (error) {
    logError('permissions', error);
    state = 'denied';
  }
  usePermissionStore.getState().setLocation(state);
  return state;
}

export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

export function openLocationSettings(): Promise<void> {
  return Linking.sendIntent('android.settings.LOCATION_SOURCE_SETTINGS').catch(error => {
    logError('permissions', error);
    return Linking.openSettings();
  });
}
