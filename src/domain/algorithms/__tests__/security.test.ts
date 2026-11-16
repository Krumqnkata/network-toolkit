import { encryptionLevel, evaluateSecurity, type SecurityInput } from '../security';
import {
  findWanService,
  parsePortMapping,
  portMappingRequest,
  resolveUrl,
  splitUrl,
} from '../upnpIgd';
import { FAULT_REPLY, IGD_DESCRIPTION, MAPPING_REPLY } from '../../../../tests/fixtures/upnp';

describe('UPnP IGD', () => {
  it('resolves URLs the way browsers do', () => {
    expect(resolveUrl('/ctl/IPConn', 'http://192.168.1.1:5000/rootDesc.xml')).toBe(
      'http://192.168.1.1:5000/ctl/IPConn',
    );
    expect(resolveUrl('ctl', 'http://192.168.1.1:5000/igd/desc.xml')).toBe(
      'http://192.168.1.1:5000/igd/ctl',
    );
    expect(resolveUrl('http://10.0.0.1/x', 'http://192.168.1.1/')).toBe('http://10.0.0.1/x');
    expect(splitUrl('http://192.168.1.1:5000/ctl/IPConn')).toEqual({
      host: '192.168.1.1',
      port: 5000,
      path: '/ctl/IPConn',
    });
    expect(splitUrl('http://192.168.1.1')).toEqual({ host: '192.168.1.1', port: 80, path: '/' });
  });

  it('finds the WAN connection service', () => {
    expect(findWanService(IGD_DESCRIPTION, 'http://192.168.1.1:5000/rootDesc.xml')).toEqual({
      serviceType: 'urn:schemas-upnp-org:service:WANIPConnection:1',
      controlUrl: 'http://192.168.1.1:5000/ctl/IPConn',
    });
    expect(findWanService('<root></root>', 'http://192.168.1.1/')).toBeNull();
  });

  it('builds a small SOAP request and reads mappings until the list ends', () => {
    const service = findWanService(IGD_DESCRIPTION, 'http://192.168.1.1:5000/rootDesc.xml')!;
    const request = portMappingRequest(service, 3);
    expect(request).toMatch(/^POST \/ctl\/IPConn HTTP\/1\.1\r\nHost: 192\.168\.1\.1:5000\r\n/);
    expect(request).toContain(
      'SOAPAction: "urn:schemas-upnp-org:service:WANIPConnection:1#GetGenericPortMappingEntry"',
    );
    expect(request).toContain('<NewPortMappingIndex>3</NewPortMappingIndex>');
    expect(request.length).toBeLessThan(1024);
    const body = request.split('\r\n\r\n')[1]!;
    expect(request).toContain(`Content-Length: ${body.length}`);

    expect(parsePortMapping(MAPPING_REPLY)).toEqual({
      protocol: 'TCP',
      externalPort: 51413,
      internalClient: '192.168.1.20',
      internalPort: 51413,
      description: 'Transmission at 51413',
      enabled: true,
      remoteHost: null,
    });
    expect(parsePortMapping(FAULT_REPLY)).toBeNull();
  });
});

describe('encryptionLevel', () => {
  it('rates Wi-Fi security', () => {
    expect(encryptionLevel('wpa3-personal', '[RSN-SAE-CCMP][ESS]')).toEqual({
      level: 'WPA3',
      severity: 'pass',
    });
    expect(encryptionLevel('wpa3-personal', '[RSN-PSK+SAE-CCMP][ESS]')).toEqual({
      level: 'WPA2/WPA3',
      severity: 'pass',
    });
    expect(encryptionLevel('wpa-personal', '[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS]')).toEqual({
      level: 'WPA2',
      severity: 'pass',
    });
    expect(encryptionLevel('wpa-personal', '[WPA2-PSK-TKIP][ESS]')).toEqual({
      level: 'WPA2 (TKIP)',
      severity: 'warn',
    });
    expect(encryptionLevel('wpa-personal', '[WPA-PSK-TKIP][ESS]')).toEqual({
      level: 'WPA',
      severity: 'fail',
    });
    expect(encryptionLevel('wep', null)).toEqual({ level: 'WEP', severity: 'fail' });
    expect(encryptionLevel('open', '[ESS]')).toEqual({ level: 'open', severity: 'fail' });
    expect(encryptionLevel(null, null)).toBeNull();
  });
});

describe('evaluateSecurity', () => {
  const safe: SecurityInput = {
    wifi: { security: 'wpa3-personal', capabilities: '[RSN-SAE-CCMP][ESS]' },
    wps: false,
    routerPorts: {
      21: 'closed',
      22: 'closed',
      23: 'closed',
      80: 'open',
      443: 'open',
      8080: 'closed',
      8443: 'closed',
    },
    upnp: { found: false, mappings: [] },
    devices: [{ name: 'TV', address: '192.168.1.30', openPorts: [] }],
    privateDns: true,
  };

  it('finds nothing wrong on a well-configured network', () => {
    const report = evaluateSecurity(safe);
    expect(report.score).toBe('good');
    expect(report.findings.every(item => item.severity === 'pass')).toBe(true);
  });

  it('puts risks first and rates the network', () => {
    const report = evaluateSecurity({
      ...safe,
      wifi: { security: 'wpa-personal', capabilities: '[WPA2-PSK-CCMP][WPS][ESS]' },
      wps: true,
      routerPorts: { ...safe.routerPorts, 23: 'open', 443: 'closed' },
      upnp: {
        found: true,
        mappings: [
          {
            protocol: 'TCP',
            externalPort: 8080,
            internalClient: '192.168.1.70',
            internalPort: 80,
            description: 'Camera',
            enabled: true,
            remoteHost: null,
          },
          {
            protocol: 'UDP',
            externalPort: 9999,
            internalClient: '192.168.1.71',
            internalPort: 9999,
            description: null,
            enabled: false,
            remoteHost: null,
          },
        ],
      },
      devices: [
        { name: 'Camera', address: '192.168.1.70', openPorts: [23] },
        { name: 'PC', address: '192.168.1.10', openPorts: [3389] },
      ],
      privateDns: false,
    });
    expect(report.score).toBe('risky');
    expect(report.findings.map(item => [item.id, item.severity])).toEqual([
      ['router-telnet', 'fail'],
      ['devices-telnet', 'fail'],
      ['wps', 'warn'],
      ['router-admin', 'warn'],
      ['upnp', 'warn'],
      ['port-forwards', 'warn'],
      ['devices-remote', 'info'],
      ['private-dns', 'info'],
      ['encryption', 'pass'],
      ['router-ftp', 'pass'],
    ]);
    expect(report.findings.find(item => item.id === 'port-forwards')).toMatchObject({
      values: { count: 1 },
      items: ['TCP 8080 → 192.168.1.70:80 (Camera)'],
    });
    expect(report.findings.find(item => item.id === 'devices-telnet')?.items).toEqual([
      'Camera (192.168.1.70)',
    ]);
  });

  it('marks what it could not check', () => {
    const report = evaluateSecurity({
      wifi: null,
      wps: null,
      routerPorts: null,
      upnp: null,
      devices: null,
      privateDns: false,
    });
    expect(report.findings.map(item => [item.id, item.severity])).toEqual([
      ['private-dns', 'info'],
      ['router-admin', 'skip'],
      ['router-telnet', 'skip'],
      ['upnp', 'skip'],
      ['devices-telnet', 'skip'],
    ]);
    expect(report.score).toBe('good');
  });
});
