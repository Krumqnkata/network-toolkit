import {
  MAX_LAN_DEVICES,
  buildTopology,
  groupAccessPoints,
  hopRole,
  layoutTopology,
  rateLink,
  type TopologyHop,
  type TopologyInput,
} from '../topology';

const hop = (ttl: number, address: string | null, rttMs: number | null): TopologyHop => ({
  ttl,
  address,
  rttMs,
  status: address ? 'ttl-exceeded' : 'timeout',
});
const reply = (ttl: number, rttMs: number): TopologyHop => ({
  ttl,
  address: '1.1.1.1',
  rttMs,
  status: 'reply',
});

function input(overrides: Partial<TopologyInput> = {}): TopologyInput {
  return {
    transport: 'wifi',
    gateway: '192.168.1.1',
    localAddress: '192.168.1.23',
    deviceName: 'Pixel 9',
    wifi: { ssid: 'Home', bssid: 'aa:bb:cc:dd:ee:01', frequencyMhz: 5180, rssi: -55 },
    operator: null,
    gatewayRttMs: 3,
    target: '1.1.1.1',
    hops: [hop(1, '192.168.1.1', 3), hop(2, '85.11.0.1', 9), reply(3, 15)],
    networks: [
      { ssid: 'Home', bssid: 'aa:bb:cc:dd:ee:01', frequencyMhz: 5180, rssi: -55 },
      { ssid: 'Home', bssid: 'aa:bb:cc:dd:ee:00', frequencyMhz: 2412, rssi: -50 },
    ],
    lan: [
      {
        address: '192.168.1.1',
        name: 'Archer AX55',
        kind: 'router',
        model: null,
        rttMs: 3,
        isSelf: false,
        isGateway: true,
      },
      {
        address: '192.168.1.23',
        name: null,
        kind: 'phone',
        model: null,
        rttMs: null,
        isSelf: true,
        isGateway: false,
      },
      {
        address: '192.168.1.40',
        name: 'Living room TV',
        kind: 'tv',
        model: 'Bravia',
        rttMs: 70,
        isSelf: false,
        isGateway: false,
      },
    ],
    bluetooth: [],
    ...overrides,
  };
}

const byId = (topology: ReturnType<typeof buildTopology>, id: string) =>
  topology.nodes.find(node => node.id === id);

describe('helpers', () => {
  it('rates links and classifies hops', () => {
    expect(rateLink(null, [20, 60])).toBe('unknown');
    expect(rateLink(10, [20, 60])).toBe('good');
    expect(rateLink(30, [20, 60])).toBe('warn');
    expect(rateLink(60, [20, 60])).toBe('bad');
    expect(hopRole('192.168.0.1')).toBe('private');
    expect(hopRole('100.72.1.1')).toBe('cgnat');
    expect(hopRole('100.128.0.1')).toBe('public');
    expect(hopRole(null)).toBe('silent');
  });

  it('groups the radios of one access point and finds the connected one', () => {
    const groups = groupAccessPoints(
      'Home',
      [
        { ssid: 'Home', bssid: 'AA:BB:CC:DD:EE:00', frequencyMhz: 2412, rssi: -40 },
        { ssid: 'Home', bssid: '02:bb:cc:dd:ee:01', frequencyMhz: 5180, rssi: -45 },
        { ssid: 'Home', bssid: 'aa:bb:cc:11:22:00', frequencyMhz: 5500, rssi: -70 },
        { ssid: 'Home', bssid: 'aa:bb:cc:99:99:00', frequencyMhz: 5500, rssi: -90 },
        { ssid: 'Other', bssid: 'aa:bb:cc:33:44:00', frequencyMhz: 2412, rssi: -30 },
      ],
      'aa:bb:cc:11:22:00',
    );
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ connected: true, bands: ['5'] });
    expect(groups[1]).toMatchObject({ connected: false, bands: ['2.4', '5'], rssi: -40 });
  });
});

describe('buildTopology', () => {
  it('draws internet → provider → router → phone and the LAN devices', () => {
    const topology = buildTopology(input());
    expect(topology.nodes.map(node => node.id)).toEqual([
      'internet',
      'hop-2',
      'router',
      'self',
      'lan-192.168.1.40',
    ]);
    expect(byId(topology, 'hop-2')).toMatchObject({ parent: 'internet', linkMs: 6 });
    expect(byId(topology, 'router')).toMatchObject({
      parent: 'hop-2',
      name: 'Archer AX55',
      bands: ['2.4', '5'],
      linkMs: 6,
      linkState: 'good',
    });
    expect(byId(topology, 'self')).toMatchObject({
      parent: 'router',
      link: 'wireless',
      linkMs: 3,
    });
    expect(byId(topology, 'lan-192.168.1.40')).toMatchObject({
      parent: 'router',
      linkState: 'bad',
    });
    expect(topology).toMatchObject({ reached: true, doubleNat: false, cgnat: false });
  });

  it('attaches the phone to its access point in a mesh network', () => {
    const topology = buildTopology(
      input({
        networks: [
          { ssid: 'Home', bssid: 'aa:bb:cc:dd:ee:01', frequencyMhz: 5180, rssi: -55 },
          { ssid: 'Home', bssid: 'aa:bb:cc:11:22:01', frequencyMhz: 5180, rssi: -60 },
        ],
      }),
    );
    expect(byId(topology, 'ap-0')).toMatchObject({ connected: true, parent: 'router' });
    expect(byId(topology, 'ap-1')).toMatchObject({ connected: false });
    expect(byId(topology, 'self')?.parent).toBe('ap-0');
    expect(byId(topology, 'lan-192.168.1.40')?.parent).toBe('router');
  });

  it('collapses long paths, merges silent hops and spots double NAT and CGNAT', () => {
    const topology = buildTopology(
      input({
        hops: [
          hop(1, '192.168.1.1', 3),
          hop(2, '192.168.0.1', 4),
          hop(3, '100.64.0.1', 10),
          hop(4, null, null),
          hop(5, null, null),
          hop(6, '85.11.0.1', 12),
          hop(7, '85.11.0.9', 14),
          hop(8, '141.101.0.1', 20),
          reply(9, 22),
        ],
      }),
    );
    // Path: 192.168.0.1, 100.64.0.1, (silent), 85.11.0.1, 85.11.0.9, 141.101.0.1 → 6 hops.
    expect(topology.hiddenHops).toBe(3);
    expect(topology.nodes.map(node => node.id)).toEqual([
      'internet',
      'hop-8',
      'more',
      'hop-3',
      'hop-2',
      'router',
      'self',
      'lan-192.168.1.40',
    ]);
    expect(byId(topology, 'more')?.count).toBe(3);
    expect(byId(topology, 'hop-3')?.linkMs).toBeNull();
    expect(byId(topology, 'hop-2')).toMatchObject({ kind: 'router', hopRole: 'private' });
    expect(topology).toMatchObject({ doubleNat: true, cgnat: true });
  });

  it('marks the internet link as broken when the target never answered', () => {
    const topology = buildTopology(
      input({ hops: [hop(1, '192.168.1.1', 3), hop(2, null, null), hop(3, null, null)] }),
    );
    expect(topology.reached).toBe(false);
    expect(byId(topology, 'hop-2')).toMatchObject({ parent: 'internet', linkState: 'bad' });
  });

  it('draws the operator on mobile data, without LAN devices', () => {
    const topology = buildTopology(
      input({
        transport: 'cellular',
        gateway: null,
        wifi: null,
        operator: 'A1',
        gatewayRttMs: null,
        hops: [hop(1, null, null), hop(2, '10.64.0.1', 45), hop(3, '62.0.0.1', 50), reply(4, 60)],
      }),
    );
    expect(topology.nodes.map(node => node.id)).toEqual(['internet', 'hop-3', 'operator', 'self']);
    expect(byId(topology, 'operator')).toMatchObject({ name: 'A1', address: '10.64.0.1' });
    expect(byId(topology, 'self')).toMatchObject({
      link: 'cellular',
      linkMs: 45,
      linkState: 'warn',
    });
    expect(topology.doubleNat).toBe(false);
  });

  it('limits LAN and Bluetooth devices', () => {
    const lan = Array.from({ length: MAX_LAN_DEVICES + 5 }, (_, i) => ({
      address: `192.168.1.${100 + i}`,
      name: null,
      kind: 'unknown',
      model: null,
      rttMs: 5,
      isSelf: false,
      isGateway: false,
    }));
    const bluetooth = Array.from({ length: 10 }, (_, i) => ({
      address: `00:00:00:00:00:0${i}`,
      name: null,
      kind: 'unknown',
      rssi: -50 - i,
    }));
    const topology = buildTopology(input({ lan, bluetooth }));
    expect(topology.hiddenDevices).toBe(5);
    const bt = topology.nodes.filter(node => node.type === 'bluetooth');
    expect(bt).toHaveLength(6);
    expect(bt[0]).toMatchObject({ parent: 'self', signalDbm: -50 });
  });
});

describe('layoutTopology', () => {
  it('stacks the tiers and wraps device rows', () => {
    const lan = Array.from({ length: 6 }, (_, i) => ({
      address: `192.168.1.${100 + i}`,
      name: null,
      kind: 'unknown',
      model: null,
      rttMs: 5,
      isSelf: false,
      isGateway: false,
    }));
    const topology = buildTopology(input({ lan }));
    const layout = layoutTopology(topology, 360); // 4 nodes per row
    const y = (id: string) => layout.positions[id]!.y;
    expect(y('internet')).toBeLessThan(y('hop-2'));
    expect(y('hop-2')).toBeLessThan(y('router'));
    expect(y('router')).toBeLessThan(y('self'));
    expect(y('self')).toBeLessThan(y('lan-192.168.1.100'));
    expect(y('lan-192.168.1.104')).toBeGreaterThan(y('lan-192.168.1.103'));
    expect(layout.positions.router!.x).toBe(180);
    expect(layout.height).toBeGreaterThan(y('lan-192.168.1.105'));
  });

  it('keeps the centre free for an odd number of access points', () => {
    const topology = buildTopology(
      input({
        networks: [
          { ssid: 'Home', bssid: 'aa:bb:cc:dd:ee:01', frequencyMhz: 5180, rssi: -55 },
          { ssid: 'Home', bssid: 'aa:bb:cc:11:22:01', frequencyMhz: 5180, rssi: -60 },
          { ssid: 'Home', bssid: 'aa:bb:cc:33:44:01', frequencyMhz: 5180, rssi: -65 },
        ],
      }),
    );
    const layout = layoutTopology(topology, 400);
    const xs = ['ap-0', 'ap-1', 'ap-2'].map(id => layout.positions[id]!.x);
    expect(xs).not.toContain(200);
  });
});
