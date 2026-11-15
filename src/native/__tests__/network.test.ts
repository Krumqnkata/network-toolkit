import { offlineSnapshot, wifiSnapshot } from '../../../tests/fixtures/networkSnapshot';
import { AppError } from '../../utils/errors';
import { getNetworkSnapshot, parseNetworkSnapshot } from '../network';
import NativeNetworkModule from '../specs/NativeNetworkModule';

const mockedGetSnapshot = NativeNetworkModule.getNetworkSnapshot as jest.MockedFunction<
  typeof NativeNetworkModule.getNetworkSnapshot
>;

describe('parseNetworkSnapshot', () => {
  it('accepts well-formed snapshots', () => {
    expect(parseNetworkSnapshot(wifiSnapshot)).toEqual(wifiSnapshot);
    expect(parseNetworkSnapshot(offlineSnapshot)).toEqual(offlineSnapshot);
  });

  it('rejects unknown transport types', () => {
    expect(() => parseNetworkSnapshot({ ...wifiSnapshot, transport: 'satellite' })).toThrow(
      AppError,
    );
  });

  it('rejects missing fields with an invalid-native-data error', () => {
    const withoutGateways: Partial<typeof wifiSnapshot> = { ...wifiSnapshot };
    delete withoutGateways.gateways;
    try {
      parseNetworkSnapshot(withoutGateways);
      throw new Error('expected parse to fail');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe('invalid-native-data');
      expect((error as AppError).message).toContain('gateways');
    }
  });

  it('rejects out-of-range values', () => {
    const bad = {
      ...wifiSnapshot,
      addresses: [{ address: '10.0.0.1', prefixLength: 200, family: 'ipv4', scope: 'global' }],
    };
    expect(() => parseNetworkSnapshot(bad)).toThrow(AppError);
  });
});

describe('getNetworkSnapshot', () => {
  it('returns the validated native result', async () => {
    mockedGetSnapshot.mockResolvedValueOnce(wifiSnapshot);
    await expect(getNetworkSnapshot()).resolves.toEqual(wifiSnapshot);
  });

  it('maps native rejections to AppError codes', async () => {
    const nativeError = Object.assign(new Error('Permission denied'), { code: 'E_PERMISSION' });
    mockedGetSnapshot.mockRejectedValueOnce(nativeError);
    await expect(getNetworkSnapshot()).rejects.toMatchObject({
      name: 'AppError',
      code: 'permission-denied',
    });
  });
});
