import { PermissionsAndroid, Platform } from 'react-native';

import { usePermissionStore } from '../../../stores/permissionStore';
import {
  ACCESS_LOCAL_NETWORK,
  ensureLocalNetwork,
  ensureLocalNetworkFor,
  hasLocalNetwork,
  isLocalNetworkError,
  isLocalTarget,
} from '../localNetworkPermission';

describe('isLocalTarget', () => {
  it('recognises home addresses the way Android 17 does', () => {
    for (const host of [
      '192.168.1.1',
      '10.0.0.5',
      '172.20.1.1',
      '169.254.3.4',
      'fe80::1',
      'fd12:3456::1',
      '[fe80::1]',
      'printer.local',
    ]) {
      expect([host, isLocalTarget(host)]).toEqual([host, true]);
    }
    for (const host of [
      '1.1.1.1',
      '127.0.0.1',
      '100.64.0.1',
      '172.32.0.1',
      'example.com',
      '2001:db8::1',
    ]) {
      expect([host, isLocalTarget(host)]).toEqual([host, false]);
    }
  });
});

describe('local network permission', () => {
  const setVersion = (version: number) =>
    jest.spyOn(Platform, 'Version', 'get').mockReturnValue(version);

  afterEach(() => {
    jest.restoreAllMocks();
    usePermissionStore.setState({ localNetwork: 'unknown' });
  });

  it('is not needed before Android 17', async () => {
    setVersion(36);
    const request = jest.spyOn(PermissionsAndroid, 'request');
    expect(await hasLocalNetwork()).toBe(true);
    await ensureLocalNetworkFor('192.168.1.1');
    expect(request).not.toHaveBeenCalled();
  });

  it('asks on Android 17 and goes ahead when allowed', async () => {
    setVersion(37);
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    const request = jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.GRANTED);
    await ensureLocalNetworkFor('192.168.1.1');
    expect(request).toHaveBeenCalledWith(ACCESS_LOCAL_NETWORK);
    expect(usePermissionStore.getState().localNetwork).toBe('granted');
  });

  it('does not ask for internet targets', async () => {
    setVersion(37);
    const request = jest.spyOn(PermissionsAndroid, 'request');
    await ensureLocalNetworkFor('1.1.1.1');
    expect(request).not.toHaveBeenCalled();
  });

  it('throws a recognisable error when refused', async () => {
    setVersion(37);
    jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
    jest
      .spyOn(PermissionsAndroid, 'request')
      .mockResolvedValue(PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN);
    const error = await ensureLocalNetwork().catch(caught => caught);
    expect(isLocalNetworkError(error)).toBe(true);
    expect(usePermissionStore.getState().localNetwork).toBe('blocked');
  });
});
