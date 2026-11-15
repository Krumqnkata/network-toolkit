import { scanResult } from '../../../tests/fixtures/wifiScan';
import { AppError } from '../../utils/errors';
import NativeWifiModule from '../specs/NativeWifiModule';
import { getCachedWifiScan, parseWifiScanResult, scanWifi } from '../wifi';

const mockedScan = NativeWifiModule.scan as jest.MockedFunction<typeof NativeWifiModule.scan>;

describe('parseWifiScanResult', () => {
  it('accepts well-formed results', () => {
    expect(parseWifiScanResult(scanResult)).toEqual(scanResult);
  });

  it('rejects malformed networks', () => {
    const bad = { ...scanResult, networks: [{ ...scanResult.networks[0], rssi: 'strong' }] };
    expect(() => parseWifiScanResult(bad)).toThrow(AppError);
  });
});

describe('scanWifi', () => {
  it('maps a missing permission to permission-denied', async () => {
    mockedScan.mockRejectedValueOnce(
      Object.assign(new Error('Precise location permission is required'), {
        code: 'E_PERMISSION',
      }),
    );
    await expect(scanWifi()).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('returns validated results', async () => {
    await expect(scanWifi()).resolves.toEqual(scanResult);
    await expect(getCachedWifiScan()).resolves.toMatchObject({ fresh: false });
  });
});
