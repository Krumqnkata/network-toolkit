import { buildTopology, type TopologyInput } from '../../../domain/algorithms/topology';
import { GLYPH_KINDS, glyphFor } from '../scene/glyphs';
import { sceneToSvg } from '../scene/primitives';
import { buildMapScene, wrapLabel, type SceneOptions } from '../scene/scene';

const palette: SceneOptions['palette'] = {
  background: '#0B1220',
  text: '#FFFFFF',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  accent: '#4C8DFF',
  line: '#64748B',
  states: { good: '#22C55E', warn: '#F59E0B', bad: '#EF4444', unknown: '#64748B' },
};
const options = (overrides: Partial<SceneOptions> = {}): SceneOptions => ({
  width: 360,
  palette,
  title: node => node.name ?? node.type,
  labels: {
    devices: count => `DEVICES · ${count}`,
    bluetooth: 'BLUETOOTH',
    ms: ms => `+${Math.round(ms)} ms`,
    noAnswer: 'no answer',
  },
  ...overrides,
});

const input: TopologyInput = {
  transport: 'wifi',
  gateway: '192.168.1.1',
  localAddress: '192.168.1.23',
  deviceName: 'Pixel',
  wifi: { ssid: 'Home', bssid: null, frequencyMhz: 5180, rssi: -50 },
  operator: null,
  providerName: 'ISP <&> "Co"',
  gatewayRttMs: 3,
  target: '1.1.1.1',
  hops: [
    { ttl: 1, address: '192.168.1.1', rttMs: 3, status: 'ttl-exceeded' },
    { ttl: 2, address: '85.11.0.1', rttMs: 9, status: 'ttl-exceeded' },
    { ttl: 3, address: '1.1.1.1', rttMs: 15, status: 'reply' },
  ],
  networks: [],
  lan: Array.from({ length: 7 }, (_, i) => ({
    address: `192.168.1.${10 + i}`,
    name: `Device ${i}`,
    kind: i % 2 ? 'tv' : 'printer',
    model: null,
    rttMs: 4,
    isSelf: false,
    isGateway: false,
  })),
  bluetooth: [{ address: 'AA:BB', name: 'Buds', kind: 'headphones', rssi: -50 }],
};

describe('wrapLabel', () => {
  it('splits long names into two lines and marks cuts', () => {
    expect(wrapLabel('Archer AX55')).toEqual(['Archer AX55']);
    expect(wrapLabel('Living Room TV')).toEqual(['Living Room', 'TV']);
    expect(wrapLabel('DS220+ - Synology DiskStation')).toEqual(['DS220+ -', 'Synology…']);
    expect(wrapLabel('Supercalifragilistic')).toEqual(['Supercalifra…']);
  });
});

describe('buildMapScene', () => {
  const scene = buildMapScene(buildTopology(input), options());

  it('gives every node a tap area and keeps them apart', () => {
    expect(scene.hits.map(hit => hit.id).sort()).toEqual(
      [
        'internet',
        'provider',
        'router',
        'self',
        'bt-AA:BB',
        ...input.lan.map(d => `lan-${d.address}`),
      ].sort(),
    );
    for (const a of scene.hits) {
      for (const b of scene.hits) {
        if (a === b) continue;
        const overlap =
          a.x < b.x + b.w - 1 && b.x < a.x + a.w - 1 && a.y < b.y + b.h - 1 && b.y < a.y + a.h - 1;
        expect([a.id, b.id, overlap]).toEqual([a.id, b.id, false]);
      }
    }
  });

  it('keeps everything inside the width and draws the link delays', () => {
    for (const hit of scene.hits) {
      expect(hit.x).toBeGreaterThanOrEqual(0);
      expect(hit.x + hit.w).toBeLessThanOrEqual(360);
    }
    const texts = scene.shapes.flatMap(shape => (shape.t === 'text' ? [shape.text] : []));
    expect(texts).toEqual(expect.arrayContaining(['+6 ms', 'DEVICES · 7', 'BLUETOOTH']));
  });

  it('adds a title and legend for export, as valid escaped SVG', () => {
    const exported = buildMapScene(
      buildTopology(input),
      options({
        width: 420,
        header: { title: 'Network map — Home', subtitle: '16 Nov 2026' },
        legend: {
          good: 'Good',
          warn: 'Slow',
          bad: 'Very slow',
          wireless: 'Wi-Fi',
          footer: 'Network Toolkit',
        },
      }),
    );
    const svg = sceneToSvg(exported);
    expect(svg).toContain('<svg xmlns="http://www.w3.org/2000/svg" width="420"');
    expect(svg).toContain('Network map — Home');
    expect(svg).toContain('ISP &lt;&amp;&gt; &quot;Co&quot;');
    expect(svg).not.toContain('<&>');
    expect(svg.match(/<linearGradient /g)?.length).toBeGreaterThan(3);
  });
});

describe('glyphs', () => {
  it('has a picture for every node and device kind', () => {
    for (const kind of [
      'internet',
      'provider',
      'operator',
      'router',
      'switch',
      'ap',
      'phone',
      'computer',
      'printer',
      'tv',
      'speaker',
      'nas',
      'camera',
      'iot',
      'headphones',
      'watch',
      'car',
    ]) {
      expect(GLYPH_KINDS).toContain(kind);
    }
    expect(glyphFor('something-new')).toBe(glyphFor('unknown'));
  });
});
