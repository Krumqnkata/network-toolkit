import { analyzeSurvey, median, rateRoom, type RoomMeasurement, type Survey } from '../survey';

function room(name: string, overrides: Partial<RoomMeasurement> = {}): RoomMeasurement {
  return {
    room: name,
    measuredAt: 0,
    rssi: -55,
    rssiMin: -57,
    rssiMax: -53,
    samples: 8,
    frequencyMhz: 5180,
    bssid: 'aa:bb:cc:dd:ee:01',
    apVendor: null,
    linkSpeedMbps: 866,
    routerMs: 3,
    routerLossPercent: 0,
    bestOtherBssid: null,
    bestOtherRssi: null,
    ...overrides,
  };
}
const survey = (...rooms: RoomMeasurement[]): Survey => ({ createdAt: 0, ssid: 'Home', rooms });
const ids = (s: Survey) => analyzeSurvey(s).advice.map(item => item.id);

describe('helpers', () => {
  it('takes the median and rates rooms', () => {
    expect(median([])).toBeNull();
    expect(median([-60, -50, -70])).toBe(-60);
    expect(median([-60, -50])).toBe(-55);
    expect(rateRoom({ rssi: -45 })).toBe('excellent');
    expect(rateRoom({ rssi: -75 })).toBe('weak');
    expect(rateRoom({ rssi: -85 })).toBe('poor');
    expect(rateRoom({ rssi: null })).toBe('unknown');
  });
});

describe('analyzeSurvey', () => {
  it('is happy when every room is strong', () => {
    const result = analyzeSurvey(
      survey(room('Living room', { rssi: -45 }), room('Kitchen', { rssi: -58 })),
    );
    expect(result.advice).toEqual([{ id: 'all-good', rooms: [] }]);
    expect(result).toMatchObject({ best: 'Living room', worst: 'Kitchen', accessPoints: 1 });
  });

  it('asks for more rooms after one measurement', () => {
    expect(ids(survey(room('Office')))).toEqual(['measure-more']);
  });

  it('finds dead zones and suggests a second access point on a single-AP home', () => {
    const result = analyzeSurvey(
      survey(
        room('Living room', { rssi: -48 }),
        room('Bedroom', { rssi: -76 }),
        room('Balcony', { rssi: -86 }),
      ),
    );
    expect(result.advice).toEqual([
      { id: 'dead-zone', rooms: ['Balcony'] },
      { id: 'weak-rooms', rooms: ['Bedroom'] },
      { id: 'add-access-point', rooms: ['Balcony', 'Bedroom'] },
    ]);
    expect(result.ratings).toMatchObject({ Bedroom: 'weak', Balcony: 'poor' });
  });

  it('suggests moving the router when no room is good', () => {
    expect(ids(survey(room('A', { rssi: -66 }), room('B', { rssi: -77 })))).toContain(
      'move-router',
    );
  });

  it('does not suggest another access point in a mesh home', () => {
    const result = ids(
      survey(
        room('Living room', { rssi: -50, bssid: 'aa:bb:cc:dd:ee:01' }),
        room('Bedroom', { rssi: -76, bssid: 'aa:bb:cc:11:22:01' }),
      ),
    );
    expect(result).toEqual(['weak-rooms']);
  });

  it('does not ask for another access point when a second one was heard', () => {
    const result = ids(
      survey(
        room('Living room', { rssi: -48 }),
        room('Balcony', { rssi: -84, bestOtherBssid: 'aa:bb:cc:11:22:01', bestOtherRssi: -60 }),
      ),
    );
    expect(result).toEqual(['dead-zone', 'sticky-client']);
  });

  it('spots a phone stuck on a far access point', () => {
    expect(ids(survey(room('A'), room('Office', { rssi: -74, bestOtherRssi: -55 })))).toContain(
      'sticky-client',
    );
  });

  it('suggests 5 GHz for strong rooms on 2.4 GHz', () => {
    const result = analyzeSurvey(
      survey(room('Living room'), room('Kitchen', { rssi: -52, frequencyMhz: 2437 })),
    );
    expect(result.advice).toEqual([{ id: 'use-5ghz', rooms: ['Kitchen'] }]);
  });

  it('flags interference when a strong signal still answers slowly', () => {
    const result = analyzeSurvey(
      survey(room('A'), room('Office', { routerMs: 45, routerLossPercent: 12 })),
    );
    expect(result.advice).toEqual([{ id: 'interference', rooms: ['Office'] }]);
  });
});
