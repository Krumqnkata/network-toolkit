import { act, render, screen, userEvent } from '@testing-library/react-native';
import React from 'react';

import { App } from '../src/app/App';
import NativeStorageModule from '../src/native/specs/NativeStorageModule';
import NativeNetToolsModule from '../src/native/specs/NativeNetToolsModule';
import { useSettingsStore } from '../src/stores/settingsStore';

const native = NativeNetToolsModule as jest.Mocked<typeof NativeNetToolsModule>;

const probe = (overrides: Record<string, unknown> = {}) => ({
  address: '1.1.1.1',
  family: 'ipv4',
  method: 'icmp',
  status: 'reply',
  rttMs: 10,
  ttl: 57,
  from: '1.1.1.1',
  ...overrides,
});

const dnsResult = (overrides: Record<string, unknown> = {}) => ({
  server: 'system',
  durationMs: 4.2,
  rcode: 0,
  authoritative: false,
  truncated: false,
  answers: [],
  authority: [],
  ...overrides,
});

async function openTool(name: RegExp) {
  const user = userEvent.setup();
  await render(<App />);
  await user.press(screen.getByRole('button', { name: /^Tools/ }));
  await user.press(screen.getByRole('button', { name }));
  return user;
}

describe('network tools', () => {
  const initialSettings = useSettingsStore.getState();
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    useSettingsStore.setState(initialSettings, true);
    // These tests count fetch calls; keep the startup update check out of them.
    NativeStorageModule.setSetting('update.auto', 'false');
    native.ping.mockReset();
    native.dnsQuery.mockReset().mockResolvedValue(dnsResult());
    native.tcpConnect.mockReset();
    native.httpRequest.mockReset();
    native.tlsInspect.mockReset();
    jest.useFakeTimers();
    // Failed probes are logged in development builds; keep the test output clean.
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    globalThis.fetch = originalFetch;
  });

  it('pings a host and shows loss and latency statistics', async () => {
    native.ping
      .mockResolvedValueOnce(probe({ rttMs: 10 }))
      .mockResolvedValueOnce(probe({ status: 'timeout', rttMs: null, ttl: null, from: null }))
      .mockResolvedValue(probe({ rttMs: 20 }));
    const user = await openTool(/^Ping/);

    await user.press(screen.getByTestId('ping-start'));
    await act(() => jest.advanceTimersByTimeAsync(10_000));

    expect(native.ping).toHaveBeenCalledTimes(10);
    expect(native.ping).toHaveBeenCalledWith('1.1.1.1', 'any', 0, 2000);
    expect(screen.getByTestId('ping-sent-received')).toHaveTextContent(/10 \/ 9/);
    expect(screen.getByTestId('ping-loss')).toHaveTextContent(/10%/);
    expect(screen.getByTestId('ping-sample-2')).toHaveTextContent(/Timeout/);
    expect(screen.getByTestId('ping-start')).toBeOnTheScreen();
  });

  it('stops a continuous ping', async () => {
    native.ping.mockResolvedValue(probe());
    const user = await openTool(/^Ping/);

    await user.press(screen.getByRole('radio', { name: 'Continuous' }));
    await user.press(screen.getByTestId('ping-start'));
    await act(() => jest.advanceTimersByTimeAsync(3_500));
    await user.press(screen.getByTestId('ping-stop'));
    const calls = native.ping.mock.calls.length;
    await act(() => jest.advanceTimersByTimeAsync(5_000));

    expect(native.ping).toHaveBeenCalledTimes(calls);
    expect(screen.getByTestId('ping-start')).toBeOnTheScreen();
  });

  it('explains the TCP fallback and shows native errors', async () => {
    native.ping.mockResolvedValueOnce(probe({ method: 'tcp', ttl: null }));
    native.ping.mockRejectedValueOnce(
      Object.assign(new Error('nowhere.invalid'), { code: 'E_UNKNOWN_HOST' }),
    );
    const user = await openTool(/^Ping/);

    await user.press(screen.getByTestId('ping-start'));
    await act(() => jest.advanceTimersByTimeAsync(1_500));

    expect(screen.getByText(/measured as the time to open a TCP connection/)).toBeOnTheScreen();
    expect(screen.getByTestId('tool-error')).toHaveTextContent(/Host not found/);
  });

  it('traces the route hop by hop', async () => {
    native.ping.mockImplementation(async (host, _family, ttl) => {
      if (ttl === 1)
        return probe({ status: 'ttl-exceeded', rttMs: null, ttl: null, from: '192.168.1.1' });
      if (ttl === 2) return probe({ status: 'timeout', rttMs: null, ttl: null, from: null });
      if (ttl === 3) return probe({ rttMs: 14 });
      // Direct ping to the first router for its round-trip time.
      return probe({ address: host, from: host, rttMs: 1.5 });
    });
    native.dnsQuery.mockImplementation(async name =>
      dnsResult({
        answers:
          name === '1.1.168.192.in-addr.arpa'
            ? [{ name, type: 12, ttl: 60, data: 'router.lan' }]
            : [],
      }),
    );
    const user = await openTool(/^Traceroute/);

    await user.press(screen.getByTestId('traceroute-start'));
    await act(() => jest.advanceTimersByTimeAsync(100));

    expect(native.ping).toHaveBeenCalledWith('one.one.one.one', 'ipv4', 1, 2000);
    expect(screen.getByLabelText('Hop 1: 192.168.1.1, 1.50 ms')).toBeOnTheScreen();
    expect(screen.getByText('router.lan')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hop 2: No reply')).toBeOnTheScreen();
    expect(screen.getByLabelText('Hop 3: 1.1.1.1, 14.0 ms')).toBeOnTheScreen();
    expect(screen.getByTestId('traceroute-outcome')).toHaveTextContent(
      'Destination reached in 3 hops.',
    );
  });

  it('looks up DNS records with a chosen resolver', async () => {
    native.dnsQuery.mockResolvedValue(
      dnsResult({
        server: '1.1.1.1',
        answers: [{ name: 'example.com', type: 15, ttl: 3600, data: '10 mail.example.com' }],
      }),
    );
    const user = await openTool(/^DNS Lookup/);

    await user.press(screen.getByRole('radio', { name: 'MX' }));
    await user.press(screen.getByRole('radio', { name: 'Cloudflare (1.1.1.1)' }));
    await user.press(screen.getByTestId('dns-run'));

    expect(native.dnsQuery).toHaveBeenCalledWith('example.com', 15, '1.1.1.1', 5000);
    expect(await screen.findByText('10 mail.example.com')).toBeOnTheScreen();
    expect(screen.getByTestId('dns-rcode')).toHaveTextContent(/NOERROR/);
    expect(screen.getByText('TTL 1h')).toBeOnTheScreen();
  });

  it('shows NXDOMAIN with an empty answer list', async () => {
    native.dnsQuery.mockResolvedValue(dnsResult({ rcode: 3 }));
    const user = await openTool(/^DNS Lookup/);

    await user.press(screen.getByTestId('dns-run'));

    expect(await screen.findByTestId('dns-empty')).toHaveTextContent('No A records.');
    expect(screen.getByTestId('dns-rcode')).toHaveTextContent(/NXDOMAIN/);
  });

  it('resolves PTR records for reverse DNS and validates the address', async () => {
    native.dnsQuery.mockResolvedValue(
      dnsResult({
        answers: [{ name: '1.1.1.1.in-addr.arpa', type: 12, ttl: 300, data: 'one.one.one.one' }],
      }),
    );
    const user = await openTool(/^Reverse DNS/);

    await user.press(screen.getByTestId('dns-run'));
    expect(native.dnsQuery).toHaveBeenCalledWith('1.1.1.1.in-addr.arpa', 12, '', 5000);
    expect(await screen.findByText('one.one.one.one')).toBeOnTheScreen();

    await user.clear(screen.getByTestId('dns-input'));
    await user.type(screen.getByTestId('dns-input'), 'example.com');
    await user.press(screen.getByTestId('dns-run'));
    expect(screen.getByText('Enter a valid IPv4 or IPv6 address.')).toBeOnTheScreen();
  });

  it('runs the reachability checklist', async () => {
    native.ping.mockResolvedValue(probe({ address: '192.168.1.1', rttMs: 2 }));
    native.dnsQuery.mockResolvedValue(
      dnsResult({ answers: [{ name: 'example.com', type: 1, ttl: 60, data: '93.184.216.34' }] }),
    );
    native.tcpConnect.mockImplementation(async (host, _port, family) =>
      family === 'ipv6'
        ? { address: host, family: 'ipv6', status: 'unreachable', connectMs: null, message: null }
        : { address: host, family: 'ipv4', status: 'open', connectMs: 12, message: null },
    );
    native.httpRequest.mockImplementation(async url => ({
      hops: [
        {
          url,
          status: url.startsWith('http:') ? 302 : 204,
          statusText: '',
          protocol: 'http/1.1',
          cipherSuite: null,
          durationMs: 30,
          headers: [],
        },
      ],
    }));
    const user = await openTool(/^Internet Reachability/);

    await user.press(screen.getByTestId('reachability-run'));

    expect(await screen.findByTestId('reachability-summary')).toHaveTextContent(
      '2 checks need attention.',
    );
    expect(screen.getByLabelText(/^Gateway: OK, 192.168.1.1 in 2.00 ms/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Captive portal: Warning, HTTP 302/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^IPv6: Warning/)).toBeOnTheScreen();
    expect(screen.getByLabelText(/^HTTPS: OK/)).toBeOnTheScreen();
  });

  it('shows redirects, headers and missing security headers', async () => {
    native.httpRequest.mockResolvedValue({
      hops: [
        {
          url: 'http://example.com/',
          status: 301,
          statusText: 'Moved Permanently',
          protocol: 'http/1.1',
          cipherSuite: null,
          durationMs: 20,
          headers: [{ name: 'Location', value: 'https://example.com/' }],
        },
        {
          url: 'https://example.com/',
          status: 200,
          statusText: 'OK',
          protocol: 'h2',
          cipherSuite: 'TLS_AES_128_GCM_SHA256',
          durationMs: 40,
          headers: [
            { name: 'Content-Type', value: 'text/html' },
            { name: 'Strict-Transport-Security', value: 'max-age=31536000' },
          ],
        },
      ],
    });
    const user = await openTool(/^HTTP Headers/);

    await user.clear(screen.getByTestId('http-url'));
    await user.type(screen.getByTestId('http-url'), 'example.com');
    await user.press(screen.getByTestId('http-run'));

    expect(native.httpRequest).toHaveBeenCalledWith('https://example.com', 'HEAD', 10, 10_000);
    expect(await screen.findByTestId('http-hop-1')).toBeOnTheScreen();
    expect(screen.getByText('200 OK')).toBeOnTheScreen();
    expect(screen.getByLabelText('Content-Type: text/html')).toBeOnTheScreen();
    expect(screen.getByTestId('security-strict-transport-security')).toHaveTextContent(/Present/);
    expect(screen.getByTestId('security-content-security-policy')).toHaveTextContent(/Missing/);
  });

  it('shows the TLS certificate chain and trust verdict', async () => {
    const now = Date.now();
    const day = 86_400_000;
    native.tlsInspect.mockResolvedValue({
      address: '93.184.216.34',
      protocol: 'TLSv1.3',
      cipherSuite: 'TLS_AES_256_GCM_SHA384',
      handshakeMs: 55,
      trusted: false,
      trustError: 'Trust anchor for certification path not found.',
      hostnameMatches: true,
      chain: [
        {
          subject: 'CN=example.com,O=Example',
          issuer: 'CN=Example CA',
          serialNumber: '0A1B',
          notBefore: now - 30 * day,
          notAfter: now + 10 * day,
          signatureAlgorithm: 'SHA256withECDSA',
          publicKeyAlgorithm: 'EC',
          publicKeyBits: 256,
          subjectAltNames: ['DNS:example.com', 'DNS:www.example.com'],
          isCa: false,
          sha256: 'AA:BB',
        },
      ],
    });
    const user = await openTool(/^TLS Certificate/);

    await user.clear(screen.getByTestId('tls-host'));
    await user.type(screen.getByTestId('tls-host'), 'https://example.com:8443/path');
    await user.press(screen.getByTestId('tls-run'));

    expect(native.tlsInspect).toHaveBeenCalledWith('example.com', 8443, 10_000);
    expect(await screen.findByText('Not trusted')).toBeOnTheScreen();
    expect(screen.getByText('Name matches')).toBeOnTheScreen();
    expect(screen.getByText('Expires soon')).toBeOnTheScreen();
    expect(screen.getByLabelText(/^Valid until: .*, 9 days left$/)).toBeOnTheScreen();
    expect(screen.getByLabelText('Public key: EC 256 bit')).toBeOnTheScreen();
  });

  it('looks up the public IP only when asked', async () => {
    const fetchMock = jest.fn(async (url: string) => ({
      ok: true,
      text: async () =>
        url.includes('[') ? 'ip=2001:db8::7\nloc=BG\ncolo=SOF' : 'ip=203.0.113.7\nloc=BG\ncolo=SOF',
    }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    native.dnsQuery.mockImplementation(async name =>
      dnsResult({
        answers: name.startsWith('7.113.0.203')
          ? [
              {
                name,
                type: 16,
                ttl: 60,
                data: '"64500 | 203.0.113.0/24 | BG | ripencc | 2010-01-01"',
              },
            ]
          : name === 'AS64500.asn.cymru.com'
          ? [
              {
                name,
                type: 16,
                ttl: 60,
                data: '"64500 | BG | ripencc | 2010-01-01 | EXAMPLE-NET, BG"',
              },
            ]
          : [],
      }),
    );
    const user = await openTool(/^IP Information/);
    expect(fetchMock).not.toHaveBeenCalled();

    await user.press(screen.getByTestId('ip-info-run'));

    expect(await screen.findByLabelText('Address: 203.0.113.7')).toBeOnTheScreen();
    expect(screen.getByLabelText('ASN: AS64500')).toBeOnTheScreen();
    expect(screen.getByLabelText('Network: EXAMPLE-NET, BG')).toBeOnTheScreen();
    expect(screen.getByLabelText('Address: 2001:db8::7')).toBeOnTheScreen();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('goes back to the tool list', async () => {
    const user = await openTool(/^Ping/);
    await user.press(screen.getByTestId('screen-back'));
    expect(
      await screen.findByText('Diagnostics for networks you own or manage.'),
    ).toBeOnTheScreen();
  });
});
