import { analyzeSegments, providerHop, seriesStats, type SegmentInput } from '../segments';

const series = (host: string, samples: (number | null)[]) => ({ host, samples });
const steady = (ms: number, lost = 0, count = 8) =>
  Array.from({ length: count }, (_, i) => (i < lost ? null : ms));

function input(overrides: Partial<SegmentInput> = {}): SegmentInput {
  return {
    transport: 'wifi',
    gateway: series('192.168.1.1', steady(3)),
    provider: series('10.0.0.1', steady(10)),
    internet: series('1.1.1.1', steady(20)),
    signalPoor: false,
    ...overrides,
  };
}

describe('seriesStats', () => {
  it('computes loss, median and jitter', () => {
    expect(seriesStats([10, null, 30, 20, null])).toEqual({
      sent: 5,
      received: 3,
      lossPercent: 40,
      medianMs: 20,
      jitterMs: 15,
    });
  });

  it('handles an empty or fully lost series', () => {
    expect(seriesStats([])).toMatchObject({ lossPercent: 0, medianMs: null, jitterMs: null });
    expect(seriesStats([null, null])).toMatchObject({ lossPercent: 100, medianMs: null });
  });
});

describe('analyzeSegments', () => {
  it('reports no problem when every segment is fast', () => {
    const result = analyzeSegments(input());
    expect(result.verdict).toBe('none');
    expect(result.segments.map(segment => segment.state)).toEqual(['good', 'good', 'good']);
    expect(result.segments.map(segment => segment.addedMs)).toEqual([3, 7, 10]);
  });

  it('blames the Wi-Fi when the gateway is slow and lossy, not the later hops', () => {
    const result = analyzeSegments(
      input({
        gateway: series('192.168.1.1', steady(90, 2)),
        provider: series('10.0.0.1', steady(100, 2)),
        internet: series('1.1.1.1', steady(110, 2)),
      }),
    );
    expect(result.verdict).toBe('local-wifi');
    expect(result.segments[0]?.state).toBe('bad');
    // Loss that already happens on the Wi-Fi is not counted again later.
    expect(result.segments[1]?.lossPercent).toBe(0);
    expect(result.segments[2]?.lossPercent).toBe(0);
  });

  it('blames the provider line when the delay appears after the router', () => {
    const result = analyzeSegments(
      input({
        provider: series('10.0.0.1', steady(120, 2)),
        internet: series('1.1.1.1', steady(130, 2)),
      }),
    );
    expect(result.verdict).toBe('access');
    expect(result.segments[1]).toMatchObject({ state: 'bad', addedMs: 117, lossPercent: 25 });
  });

  it('blames the internet when only the last segment is slow', () => {
    const result = analyzeSegments(input({ internet: series('1.1.1.1', steady(260)) }));
    expect(result.verdict).toBe('internet');
    expect(result.segments[2]).toMatchObject({ state: 'bad', addedMs: 250 });
  });

  it('suspects the router when neither it nor the internet answers', () => {
    const result = analyzeSegments(
      input({
        gateway: series('192.168.1.1', steady(0, 8)),
        provider: null,
        internet: series('1.1.1.1', steady(0, 8)),
      }),
    );
    expect(result.verdict).toBe('router');
  });

  it('treats a router that ignores ping as unknown, not broken', () => {
    const result = analyzeSegments(
      input({ gateway: series('192.168.1.1', steady(0, 8)), provider: null }),
    );
    expect(result.segments[0]?.state).toBe('unknown');
    expect(result.verdict).toBe('none');
  });

  it('blames the internet when it is unreachable but the router is fine', () => {
    const result = analyzeSegments(
      input({ provider: null, internet: series('1.1.1.1', steady(0, 8)) }),
    );
    expect(result.segments[2]).toMatchObject({ lossPercent: 100, state: 'bad' });
    expect(result.verdict).toBe('internet');
  });

  it('blames the radio link on mobile data', () => {
    const result = analyzeSegments(
      input({
        transport: 'cellular',
        gateway: null,
        provider: series('10.64.0.1', steady(140)),
        internet: series('1.1.1.1', steady(150)),
      }),
    );
    expect(result.segments[0]?.state).toBe('unknown');
    expect(result.verdict).toBe('local-radio');
  });

  it('blames a weak signal when the local link is only slightly worse', () => {
    const result = analyzeSegments(
      input({ gateway: series('192.168.1.1', steady(25)), signalPoor: true }),
    );
    expect(result.verdict).toBe('local-wifi');
  });

  it('reports offline without segments', () => {
    expect(analyzeSegments(input({ transport: 'none' }))).toEqual({
      segments: [],
      verdict: 'offline',
    });
  });
});

describe('providerHop', () => {
  it('returns the first answering hop after the gateway', () => {
    expect(
      providerHop(
        [
          { ttl: 2, address: '10.0.0.1' },
          { ttl: 1, address: '192.168.1.1' },
        ],
        '192.168.1.1',
      ),
    ).toBe('10.0.0.1');
    expect(providerHop([{ ttl: 1, address: null }], null)).toBeNull();
  });
});
