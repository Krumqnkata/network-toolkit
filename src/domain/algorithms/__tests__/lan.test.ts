import {
  assembleMdns,
  displayName,
  guessKind,
  modelName,
  parseTxtAttributes,
  parseUpnpDescription,
  serviceTypesFrom,
  splitInstanceName,
  type LanDevice,
} from '../devices';
import { chunk, COMMON_PORTS, parsePortList, serviceName } from '../ports';
import {
  compareIpv4,
  intToIpv4,
  ipv4ToInt,
  isRandomizedMac,
  MAX_SCAN_HOSTS,
  scanRange,
} from '../subnet';

const device = (overrides: Partial<LanDevice> = {}): LanDevice => ({
  address: '192.168.1.20',
  isSelf: false,
  isGateway: false,
  source: 'tcp',
  rttMs: 3,
  openPorts: [],
  hostname: null,
  mdnsHost: null,
  services: [],
  netbiosName: null,
  workgroup: null,
  mac: null,
  upnp: null,
  ...overrides,
});

describe('subnet', () => {
  it('converts IPv4 to and from integers', () => {
    expect(ipv4ToInt('192.168.1.1')).toBe(3_232_235_777);
    expect(intToIpv4(3_232_235_777)).toBe('192.168.1.1');
    expect(compareIpv4('192.168.1.9', '192.168.1.10')).toBeLessThan(0);
  });

  it('lists hosts without network and broadcast addresses', () => {
    const range = scanRange('192.168.1.57', 24);
    expect(range?.cidr).toBe('192.168.1.0/24');
    expect(range?.hosts).toHaveLength(254);
    expect(range?.hosts[0]).toBe('192.168.1.1');
    expect(range?.hosts.at(-1)).toBe('192.168.1.254');
    expect(range?.truncated).toBe(false);
  });

  it('scans a /22 fully and reduces larger subnets to the /24 around the device', () => {
    expect(scanRange('10.0.5.9', 22)?.hosts).toHaveLength(MAX_SCAN_HOSTS);
    const big = scanRange('10.0.5.9', 16);
    expect(big).toMatchObject({ cidr: '10.0.5.0/24', truncated: true });
    expect(scanRange('10.0.0.1', 31)).toBeNull();
    expect(scanRange('not-an-ip', 24)).toBeNull();
  });

  it('detects randomized MAC addresses', () => {
    expect(isRandomizedMac('DA:A1:19:00:00:01')).toBe(true);
    expect(isRandomizedMac('3C:52:82:01:02:03')).toBe(false);
  });
});

describe('ports', () => {
  it('parses lists and ranges', () => {
    expect(parsePortList('22, 80,8000-8002')).toEqual([22, 80, 8000, 8001, 8002]);
    expect(parsePortList('443,443')).toEqual([443]);
    expect(parsePortList('0')).toBeNull();
    expect(parsePortList('10-5')).toBeNull();
    expect(parsePortList('70000')).toBeNull();
    expect(parsePortList('http')).toBeNull();
    expect(parsePortList('')).toBeNull();
    expect(parsePortList('1-100', 50)).toBeNull();
  });

  it('names services and keeps the common preset sorted', () => {
    expect(serviceName(22)).toBe('SSH');
    expect(serviceName(1)).toBeNull();
    expect([...COMMON_PORTS].sort((a, b) => a - b)).toEqual(COMMON_PORTS);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe('devices', () => {
  it('parses TXT attributes', () => {
    expect(parseTxtAttributes('"fn=Living Room" "md=Chromecast" "flag"')).toEqual({
      fn: 'Living Room',
      md: 'Chromecast',
      flag: '',
    });
  });

  it('splits instance names, including escaped dots', () => {
    expect(splitInstanceName('Office Printer._ipp._tcp.local')).toEqual({
      instance: 'Office Printer',
      type: '_ipp._tcp',
    });
    expect(splitInstanceName('Box\\.TV._airplay._tcp.local')?.instance).toBe('Box.TV');
    expect(splitInstanceName('_ipp._tcp.local')).toBeNull();
  });

  it('assembles services from PTR, SRV, TXT and A records', () => {
    const services = assembleMdns([
      {
        from: '192.168.1.30',
        records: [
          {
            name: '_googlecast._tcp.local',
            type: 12,
            data: 'Living-Room-TV._googlecast._tcp.local',
          },
          { name: 'Living-Room-TV._googlecast._tcp.local', type: 33, data: '0 0 8009 abc.local' },
          {
            name: 'Living-Room-TV._googlecast._tcp.local',
            type: 16,
            data: '"fn=Living Room TV" "md=Chromecast"',
          },
          { name: 'abc.local', type: 1, data: '192.168.1.31' },
        ],
      },
      {
        from: '192.168.1.40',
        records: [{ name: '_ipp._tcp.local', type: 12, data: 'Printer._ipp._tcp.local' }],
      },
    ]);
    expect(services.get('192.168.1.31')).toEqual([
      {
        type: '_googlecast._tcp',
        instance: 'Living-Room-TV',
        host: 'abc.local',
        port: 8009,
        txt: { fn: 'Living Room TV', md: 'Chromecast' },
      },
    ]);
    expect(services.get('192.168.1.40')?.[0]).toMatchObject({ instance: 'Printer', port: null });
  });

  it('lists announced service types', () => {
    expect(
      serviceTypesFrom([
        {
          from: '192.168.1.5',
          records: [
            { name: '_services._dns-sd._udp.local', type: 12, data: '_hap._tcp.local' },
            { name: '_services._dns-sd._udp.local', type: 12, data: 'garbage' },
          ],
        },
      ]),
    ).toEqual(['_hap._tcp.local']);
  });

  it('parses UPnP descriptions', () => {
    const xml =
      '<root><device><deviceType>urn:schemas-upnp-org:device:InternetGatewayDevice:1</deviceType>' +
      '<friendlyName>Home &amp; Office Router</friendlyName><manufacturer>Acme</manufacturer>' +
      '<modelName>R-1</modelName></device></root>';
    expect(parseUpnpDescription(xml, 'Linux UPnP/1.1')).toEqual({
      friendlyName: 'Home & Office Router',
      manufacturer: 'Acme',
      modelName: 'R-1',
      deviceType: 'urn:schemas-upnp-org:device:InternetGatewayDevice:1',
      server: 'Linux UPnP/1.1',
    });
  });

  it('guesses device kinds', () => {
    expect(guessKind(device({ isGateway: true }))).toBe('router');
    expect(
      guessKind(
        device({
          services: [{ type: '_ipp._tcp', instance: 'P', host: null, port: 631, txt: {} }],
        }),
      ),
    ).toBe('printer');
    expect(guessKind(device({ openPorts: [62078] }))).toBe('phone');
    expect(guessKind(device({ netbiosName: 'DESKTOP-1' }))).toBe('computer');
    expect(guessKind(device())).toBe('unknown');
  });

  it('picks the friendliest name and a model', () => {
    const cast = device({
      hostname: 'android-123.lan',
      services: [
        {
          type: '_googlecast._tcp',
          instance: 'Chromecast-abc',
          host: 'abc.local',
          port: 8009,
          txt: { fn: 'Living Room TV', md: 'Chromecast' },
        },
      ],
    });
    expect(displayName(cast)).toBe('Living Room TV');
    expect(modelName(cast)).toBe('Chromecast');
    expect(displayName(device({ hostname: 'nas.lan', netbiosName: 'NAS' }))).toBe('NAS');
    expect(displayName(device({ mdnsHost: 'pi.local' }))).toBe('pi');
    expect(displayName(device())).toBeNull();
  });
});
