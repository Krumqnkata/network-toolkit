import { DNS_RECORD_TYPES, formatTtl, rcodeName, recordTypeName, txtValue } from '../dns';
import {
  cymruOriginName,
  expandIPv6,
  isIPv4,
  isIPv6,
  isIpAddress,
  isPrivateIPv4,
  reverseDnsName,
} from '../ip';
import { parseCymruAsName, parseCymruOrigin, parseTrace } from '../ipInfo';
import { latencyLevel, pingStats, type PingSample } from '../ping';
import {
  certificateValidity,
  daysUntil,
  dnAttribute,
  dnDisplayName,
  httpStatusTone,
  normalizeUrl,
  parseHostPort,
  securityHeaders,
} from '../web';

describe('ip', () => {
  it('validates IPv4', () => {
    expect(isIPv4('192.168.1.1')).toBe(true);
    expect(isIPv4('255.255.255.255')).toBe(true);
    expect(isIPv4('256.1.1.1')).toBe(false);
    expect(isIPv4('01.1.1.1')).toBe(false);
    expect(isIPv4('1.1.1')).toBe(false);
  });

  it('expands IPv6, including embedded IPv4 and zone indexes', () => {
    expect(expandIPv6('2606:4700::1111')).toEqual([
      '2606',
      '4700',
      '0000',
      '0000',
      '0000',
      '0000',
      '0000',
      '1111',
    ]);
    expect(expandIPv6('::1')?.join(':')).toBe('0000:0000:0000:0000:0000:0000:0000:0001');
    expect(expandIPv6('::ffff:192.0.2.1')?.slice(-2)).toEqual(['c000', '0201']);
    expect(expandIPv6('fe80::1%wlan0')?.[0]).toBe('fe80');
    expect(expandIPv6('[2001:db8::1]')?.[1]).toBe('0db8');
  });

  it('rejects malformed IPv6', () => {
    expect(isIPv6('1::2::3')).toBe(false);
    expect(isIPv6('12345::1')).toBe(false);
    expect(isIPv6('1:2:3:4:5:6:7')).toBe(false);
    expect(isIPv6('1:2:3:4:5:6:7:8:9')).toBe(false);
    expect(isIPv6('1.2.3.4')).toBe(false);
    expect(isIpAddress('example.com')).toBe(false);
  });

  it('builds reverse DNS names', () => {
    expect(reverseDnsName('1.2.3.4')).toBe('4.3.2.1.in-addr.arpa');
    expect(reverseDnsName('2001:db8::1')).toBe(
      '1.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.0.8.b.d.0.1.0.0.2.ip6.arpa',
    );
    expect(reverseDnsName('not an ip')).toBeNull();
  });

  it('builds Team Cymru origin names', () => {
    expect(cymruOriginName('1.1.1.1')).toBe('1.1.1.1.origin.asn.cymru.com');
    expect(cymruOriginName('2606:4700::1')).toMatch(/^1\.0\.0\.0\..*\.origin6\.asn\.cymru\.com$/);
  });

  it('detects private IPv4 ranges', () => {
    for (const ip of ['10.0.0.1', '172.16.0.1', '192.168.0.1', '127.0.0.1', '100.64.0.1']) {
      expect(isPrivateIPv4(ip)).toBe(true);
    }
    expect(isPrivateIPv4('172.32.0.1')).toBe(false);
    expect(isPrivateIPv4('8.8.8.8')).toBe(false);
  });
});

describe('ping', () => {
  const sample = (seq: number, rttMs: number | null): PingSample => ({
    seq,
    status: rttMs === null ? 'timeout' : 'reply',
    rttMs,
    ttl: rttMs === null ? null : 57,
    timestamp: seq * 1000,
  });

  it('computes loss, min/avg/max and jitter', () => {
    const stats = pingStats([sample(1, 10), sample(2, 20), sample(3, null), sample(4, 15)]);
    expect(stats).toEqual({
      sent: 4,
      received: 3,
      lossPercent: 25,
      minMs: 10,
      avgMs: 15,
      maxMs: 20,
      jitterMs: 7.5,
    });
  });

  it('handles no samples and total loss', () => {
    expect(pingStats([]).lossPercent).toBe(0);
    expect(pingStats([sample(1, null)])).toMatchObject({ lossPercent: 100, avgMs: null });
    expect(pingStats([sample(1, 5)]).jitterMs).toBeNull();
  });

  it('classifies latency', () => {
    expect(latencyLevel(20)).toBe('good');
    expect(latencyLevel(80)).toBe('fair');
    expect(latencyLevel(300)).toBe('poor');
    expect(latencyLevel(null)).toBe('none');
  });
});

describe('dns', () => {
  it('names record types and response codes', () => {
    expect(recordTypeName(DNS_RECORD_TYPES.AAAA)).toBe('AAAA');
    expect(recordTypeName(99)).toBe('TYPE99');
    expect(rcodeName(3)).toBe('NXDOMAIN');
    expect(rcodeName(9)).toBe('RCODE9');
  });

  it('formats TTLs', () => {
    expect(formatTtl(30)).toBe('30s');
    expect(formatTtl(300)).toBe('5m');
    expect(formatTtl(3900)).toBe('1h 5m');
    expect(formatTtl(90_061)).toBe('1d 1h');
  });

  it('joins TXT character strings', () => {
    expect(txtValue('"v=spf1 " "-all"')).toBe('v=spf1 -all');
    expect(txtValue('"say \\"hi\\""')).toBe('say "hi"');
    expect(txtValue('plain')).toBe('plain');
  });
});

describe('web', () => {
  it('normalizes URLs', () => {
    expect(normalizeUrl('example.com/path')).toBe('https://example.com/path');
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
    expect(normalizeUrl('  ')).toBe('');
  });

  it('parses host and port from several forms', () => {
    expect(parseHostPort('example.com')).toEqual({ host: 'example.com', port: null });
    expect(parseHostPort('example.com:8443')).toEqual({ host: 'example.com', port: 8443 });
    expect(parseHostPort('https://user@example.com/x?y')).toEqual({
      host: 'example.com',
      port: 443,
    });
    expect(parseHostPort('http://example.com')).toEqual({ host: 'example.com', port: 80 });
    expect(parseHostPort('[2001:db8::1]:853')).toEqual({ host: '2001:db8::1', port: 853 });
    expect(parseHostPort('2001:db8::1')).toEqual({ host: '2001:db8::1', port: null });
    expect(parseHostPort('')).toBeNull();
    expect(parseHostPort(':443')).toBeNull();
  });

  it('maps status codes to tones', () => {
    expect(httpStatusTone(204)).toBe('success');
    expect(httpStatusTone(301)).toBe('info');
    expect(httpStatusTone(404)).toBe('warning');
    expect(httpStatusTone(503)).toBe('danger');
  });

  it('checks security headers case-insensitively', () => {
    const result = securityHeaders([
      { name: 'Strict-Transport-Security', value: 'max-age=31536000' },
      { name: 'X-Content-Type-Options', value: 'nosniff' },
    ]);
    expect(result.filter(header => header.present).map(header => header.name)).toEqual([
      'strict-transport-security',
      'x-content-type-options',
    ]);
  });

  it('reads distinguished names, including escaped commas', () => {
    const dn = 'CN=example.com,O=Example\\, Inc.,C=US';
    expect(dnAttribute(dn, 'cn')).toBe('example.com');
    expect(dnAttribute(dn, 'O')).toBe('Example, Inc.');
    expect(dnAttribute(dn, 'OU')).toBeNull();
    expect(dnDisplayName('O=Only Org,C=US')).toBe('Only Org');
    expect(dnDisplayName('C=US')).toBe('C=US');
  });

  it('classifies certificate validity', () => {
    const day = 86_400_000;
    const now = 1_000 * day;
    expect(daysUntil(now + 10.5 * day, now)).toBe(10);
    expect(certificateValidity(now - day, now + 90 * day, now)).toBe('valid');
    expect(certificateValidity(now - day, now + 10 * day, now)).toBe('expiring');
    expect(certificateValidity(now - 10 * day, now - day, now)).toBe('expired');
    expect(certificateValidity(now + day, now + 90 * day, now)).toBe('not-yet-valid');
  });
});

describe('ipInfo', () => {
  it('parses the Cloudflare trace format', () => {
    expect(parseTrace('fl=1\nip=203.0.113.7\nloc=BG\ncolo=SOF\n')).toMatchObject({
      ip: '203.0.113.7',
      loc: 'BG',
      colo: 'SOF',
    });
  });

  it('parses Team Cymru origin and AS name records', () => {
    expect(parseCymruOrigin('13335 | 1.1.1.0/24 | AU | apnic | 2011-08-11')).toEqual({
      asn: 13335,
      prefix: '1.1.1.0/24',
      country: 'AU',
      registry: 'apnic',
    });
    expect(parseCymruOrigin('64496 64511 | 192.0.2.0/24 | US | arin |')?.asn).toBe(64496);
    expect(parseCymruOrigin('garbage')).toBeNull();
    expect(
      parseCymruAsName('13335 | US | arin | 2010-07-14 | CLOUDFLARENET - Cloudflare, Inc., US'),
    ).toBe('CLOUDFLARENET - Cloudflare, Inc., US');
    expect(parseCymruAsName('13335 | US')).toBeNull();
  });
});
