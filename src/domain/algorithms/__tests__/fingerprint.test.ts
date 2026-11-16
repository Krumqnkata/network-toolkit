import {
  certificateName,
  certificateOrganization,
  decodeEntities,
  identify,
  osFromTtl,
  parseHttpBanner,
  parseSshBanner,
  type Fingerprint,
} from '../fingerprint';
import { isLocallyAdministered, macVendor, ouiPrefix } from '../vendor';

const empty: Fingerprint = {
  ttl: null,
  os: null,
  http: null,
  ssh: null,
  tlsSubject: null,
  tlsIssuer: null,
  vendor: null,
};

describe('osFromTtl', () => {
  it('maps reply TTLs to the usual initial values', () => {
    expect(osFromTtl(64)).toBe('unix');
    expect(osFromTtl(63)).toBe('unix');
    expect(osFromTtl(128)).toBe('windows');
    expect(osFromTtl(127)).toBe('windows');
    expect(osFromTtl(255)).toBe('network');
    expect(osFromTtl(null)).toBeNull();
    expect(osFromTtl(0)).toBeNull();
  });
});

describe('parseHttpBanner', () => {
  it('reads the server header and the page title', () => {
    const banner = parseHttpBanner(
      'HTTP/1.1 200 OK\r\nServer: lighttpd/1.4.59\r\nContent-Type: text/html\r\n\r\n' +
        '<html><head><TITLE>\n  Synology&nbsp;DiskStation &amp; more </TITLE></head>',
    );
    expect(banner).toEqual({
      status: 200,
      server: 'lighttpd/1.4.59',
      title: 'Synology DiskStation & more',
      realm: null,
    });
  });

  it('reads the authentication realm', () => {
    expect(
      parseHttpBanner(
        'HTTP/1.0 401 Unauthorized\r\nWWW-Authenticate: Basic realm="TP-LINK Archer C7"\r\n\r\n',
      ),
    ).toMatchObject({ status: 401, realm: 'TP-LINK Archer C7', title: null });
  });

  it('ignores replies that are not HTTP', () => {
    expect(parseHttpBanner('SSH-2.0-OpenSSH_9.6\r\n')).toBeNull();
  });

  it('decodes numeric entities', () => {
    expect(decodeEntities('FRITZ&#33;Box &#x2014; 7590')).toBe('FRITZ!Box — 7590');
    expect(decodeEntities('&bogus; &#0;')).toBe('&bogus; &#0;');
  });
});

describe('parseSshBanner', () => {
  it('reads the software and the distribution', () => {
    expect(parseSshBanner('SSH-2.0-OpenSSH_9.6p1 Ubuntu-3ubuntu13.5\r\n')).toEqual({
      software: 'OpenSSH 9.6p1',
      os: 'Ubuntu',
    });
    expect(parseSshBanner('SSH-2.0-OpenSSH_8.4p1 Raspbian-5+deb11u3\r\n')?.os).toBe(
      'Raspberry Pi OS',
    );
    expect(parseSshBanner('SSH-2.0-dropbear_2022.83\r\n')).toEqual({
      software: 'dropbear 2022.83',
      os: null,
    });
    expect(parseSshBanner('220 FTP ready')).toBeNull();
  });
});

describe('certificates', () => {
  it('extracts the common name and organisation', () => {
    expect(certificateName('CN=fritz.box,O=AVM GmbH,C=DE')).toBe('fritz.box');
    expect(certificateName('O=Only Org')).toBe('Only Org');
    expect(certificateOrganization('CN=x, O=Synology Inc., C=TW')).toBe('Synology Inc.');
    expect(certificateName(null)).toBeNull();
  });
});

describe('identify', () => {
  it('recognises brands and types from banners', () => {
    expect(
      identify({
        ...empty,
        http: {
          status: 200,
          server: null,
          title: 'RouterOS router configuration page',
          realm: null,
        },
      }),
    ).toEqual({ kind: 'router', brand: 'MikroTik', product: 'RouterOS router configuration page' });
    expect(identify({ ...empty, tlsSubject: 'CN=synology,O=Synology Inc.' })).toMatchObject({
      kind: 'nas',
      brand: 'Synology',
    });
    expect(
      identify({
        ...empty,
        http: { status: 200, server: 'HP HTTP Server; HP LaserJet', title: null, realm: null },
      }),
    ).toMatchObject({ kind: 'printer', brand: 'HP' });
  });

  it('falls back to the TTL and the SSH server', () => {
    expect(identify({ ...empty, ttl: 128, os: 'windows' }).kind).toBe('computer');
    expect(identify({ ...empty, ssh: { software: 'dropbear 2022.83', os: null } }).kind).toBe(
      'router',
    );
    expect(identify({ ...empty, ssh: { software: 'OpenSSH 9.6p1', os: 'Debian' } }).kind).toBe(
      'computer',
    );
    expect(identify({ ...empty, ttl: 64, os: 'unix' })).toEqual({
      kind: null,
      brand: null,
      product: null,
    });
  });

  it('does not use generic page titles as a name', () => {
    expect(
      identify({ ...empty, http: { status: 200, server: null, title: 'Login', realm: null } })
        .product,
    ).toBeNull();
    expect(
      identify({ ...empty, http: { status: 200, server: null, title: '192.168.1.1', realm: null } })
        .product,
    ).toBeNull();
  });

  it('uses the network card maker as a hint', () => {
    expect(identify({ ...empty, vendor: 'Raspberry Pi' })).toMatchObject({
      kind: 'computer',
      brand: 'Raspberry Pi',
    });
  });
});

describe('macVendor', () => {
  it('finds the maker in the IEEE registry', () => {
    expect(macVendor('50:C7:BF:12:34:56')).toBe('TP-Link');
    expect(macVendor('b8-27-eb-00-00-01')).toBe('Raspberry Pi');
    expect(macVendor('F09FC2000000')).toBe('Ubiquiti');
    expect(macVendor('74:4D:28:00:00:00')).toBe('MikroTik');
  });

  it('returns null for random, unknown or malformed addresses', () => {
    expect(isLocallyAdministered('da:a1:19:00:00:01')).toBe(true);
    expect(macVendor('da:a1:19:00:00:01')).toBeNull();
    expect(macVendor('zz')).toBeNull();
    expect(macVendor(null)).toBeNull();
    expect(ouiPrefix('aa:bb')).toBeNull();
  });
});
