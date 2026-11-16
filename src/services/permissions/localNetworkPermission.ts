import { PermissionsAndroid, Platform, type Permission } from 'react-native';

import { usePermissionStore, type PermissionState } from '../../stores/permissionStore';
import { AppError, logError } from '../../utils/errors';

/**
 * Android 17 (API 37) "local network" permission. Apps that target 37 can
 * reach devices on the home network (router, LAN devices, mDNS, SSDP) only
 * with it; the internet is not affected. It belongs to the "Nearby devices"
 * group, so users who allowed Bluetooth are not asked again.
 * See https://developer.android.com/privacy-and-security/local-network-permission
 */
export const ACCESS_LOCAL_NETWORK = 'android.permission.ACCESS_LOCAL_NETWORK' as Permission;

/** Error message that marks a missing local network permission. */
export const LOCAL_NETWORK_ERROR = 'local-network';

/** Only Android 17+ asks; older versions grant local network access with INTERNET. */
export function needsLocalNetworkPermission(): boolean {
  // The app is Android-only; API level 37 is Android 17.
  return Number(Platform.Version) >= 37;
}

/** True when local network traffic is allowed. Never shows a prompt. */
export async function hasLocalNetwork(): Promise<boolean> {
  if (!needsLocalNetworkPermission()) return true;
  try {
    const granted = await PermissionsAndroid.check(ACCESS_LOCAL_NETWORK);
    if (granted) usePermissionStore.getState().setLocalNetwork('granted');
    return granted;
  } catch (error) {
    logError('permissions', error);
    return false;
  }
}

/** Asks for the permission if needed. Call only from something the user started. */
export async function requestLocalNetwork(): Promise<PermissionState> {
  if (!needsLocalNetworkPermission()) return 'granted';
  let state: PermissionState;
  try {
    const result = await PermissionsAndroid.request(ACCESS_LOCAL_NETWORK);
    state =
      result === PermissionsAndroid.RESULTS.GRANTED
        ? 'granted'
        : result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN
        ? 'blocked'
        : 'denied';
  } catch (error) {
    logError('permissions', error);
    state = 'denied';
  }
  usePermissionStore.getState().setLocalNetwork(state);
  return state;
}

/**
 * Makes sure local network access is allowed before a user-started action
 * (LAN scan, map, health check, a tool aimed at a home address); asks once if
 * needed and throws a recognisable error when it is refused.
 */
export async function ensureLocalNetwork(): Promise<void> {
  if (await hasLocalNetwork()) return;
  const state = await requestLocalNetwork();
  if (state !== 'granted') {
    throw new AppError('permission-denied', LOCAL_NETWORK_ERROR);
  }
}

/**
 * Whether a target is on the local network as Android counts it: private
 * IPv4 (10/8, 172.16/12, 192.168/16), link-local, IPv6 unique-local and
 * `.local` names. Loopback and the provider's shared (CGNAT) range are not.
 */
export function isLocalTarget(host: string): boolean {
  const value = host
    .trim()
    .replace(/^\[|\]$/g, '')
    .toLowerCase();
  if (/\.local\.?$/.test(value)) return true;
  const v4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(value);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    return (
      a === 10 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254)
    );
  }
  return /^fe[89ab][0-9a-f]:/.test(value) || /^f[cd][0-9a-f]{2}:/.test(value);
}

/** Before a tool talks to `host`: asks for local network access when it is a home address. */
export async function ensureLocalNetworkFor(host: string): Promise<void> {
  if (needsLocalNetworkPermission() && isLocalTarget(host)) await ensureLocalNetwork();
}

export function isLocalNetworkError(error: { code: string; message: string } | null): boolean {
  return !!error && error.code === 'permission-denied' && error.message === LOCAL_NETWORK_ERROR;
}
