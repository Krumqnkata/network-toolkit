import { AppError } from '../../utils/errors';
import { dnsQuery, httpRequest, ping, tcpConnect, tlsInspect } from '../netTools';
import NativeNetToolsModule from '../specs/NativeNetToolsModule';

const native = NativeNetToolsModule as jest.Mocked<typeof NativeNetToolsModule>;

const reply = {
  address: '1.1.1.1',
  family: 'ipv4',
  method: 'icmp',
  status: 'reply',
  rttMs: 12.3,
  ttl: 57,
  from: '1.1.1.1',
};

describe('netTools wrappers', () => {
  beforeEach(() => jest.resetAllMocks());

  it('passes defaults to native ping and validates the result', async () => {
    native.ping.mockResolvedValue(reply);
    await expect(ping('1.1.1.1')).resolves.toEqual(reply);
    expect(native.ping).toHaveBeenCalledWith('1.1.1.1', 'any', 0, 2000);
  });

  it('rejects malformed native data', async () => {
    native.ping.mockResolvedValue({ ...reply, status: 'maybe' });
    await expect(ping('1.1.1.1')).rejects.toMatchObject({ code: 'invalid-native-data' });
    await expect(ping('1.1.1.1')).rejects.toBeInstanceOf(AppError);
  });

  it.each([
    ['E_UNKNOWN_HOST', 'unknown-host'],
    ['E_TIMEOUT', 'timeout'],
    ['E_INVALID_INPUT', 'invalid-input'],
    ['E_UNSUPPORTED', 'unsupported'],
    ['E_NETWORK', 'network'],
  ])('maps %s to %s', async (nativeCode, code) => {
    native.tcpConnect.mockRejectedValue(Object.assign(new Error('x'), { code: nativeCode }));
    await expect(tcpConnect('example.com', 443)).rejects.toMatchObject({ code });
  });

  it('uses an empty server string for the system resolver', async () => {
    native.dnsQuery.mockResolvedValue({
      server: 'system',
      durationMs: 4,
      rcode: 0,
      authoritative: false,
      truncated: false,
      answers: [{ name: 'example.com', type: 1, ttl: 300, data: '93.184.216.34' }],
      authority: [],
    });
    await dnsQuery('example.com', 1);
    expect(native.dnsQuery).toHaveBeenCalledWith('example.com', 1, '', 5000);
    await dnsQuery('example.com', 28, '1.1.1.1', 2000);
    expect(native.dnsQuery).toHaveBeenLastCalledWith('example.com', 28, '1.1.1.1', 2000);
  });

  it('validates HTTP and TLS results', async () => {
    native.httpRequest.mockResolvedValue({ hops: [{ url: 'https://example.com/' }] });
    await expect(httpRequest('https://example.com')).rejects.toMatchObject({
      code: 'invalid-native-data',
    });
    native.tlsInspect.mockResolvedValue({ address: '1.2.3.4' });
    await expect(tlsInspect('example.com')).rejects.toMatchObject({
      code: 'invalid-native-data',
    });
  });
});
