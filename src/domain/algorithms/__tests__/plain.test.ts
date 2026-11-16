import {
  cellularRating,
  connectionSummary,
  latencyRating,
  providerDisplayName,
  speedUse,
  wifiRating,
} from '../plain';

describe('plain-language ratings', () => {
  it('rates latency', () => {
    expect(latencyRating(null)).toBeNull();
    expect(latencyRating(12)).toBe('great');
    expect(latencyRating(45)).toBe('good');
    expect(latencyRating(90)).toBe('ok');
    expect(latencyRating(250)).toBe('poor');
  });

  it('says what a download speed is good for', () => {
    expect(speedUse(null)).toBeNull();
    expect(speedUse(3)).toBe('basic');
    expect(speedUse(15)).toBe('hd');
    expect(speedUse(60)).toBe('uhd');
    expect(speedUse(300)).toBe('all');
  });

  it('rates mobile signal by dBm, else by Android level', () => {
    expect(cellularRating(-80, null)).toBe('great');
    expect(cellularRating(-84, 3)).toBe('great');
    expect(cellularRating(-92, null)).toBe('good');
    expect(cellularRating(-101, null)).toBe('ok');
    expect(cellularRating(-115, null)).toBe('poor');
    expect(cellularRating(null, 4)).toBe('great');
    expect(cellularRating(null, 1)).toBe('poor');
    expect(cellularRating(null, null)).toBeNull();
  });

  it('rates Wi-Fi signal', () => {
    expect(wifiRating(-50)).toBe('great');
    expect(wifiRating(-62)).toBe('good');
    expect(wifiRating(-72)).toBe('ok');
    expect(wifiRating(-82)).toBe('poor');
    expect(wifiRating(null)).toBeNull();
  });

  it('shortens AS names to a provider name', () => {
    expect(providerDisplayName('CLOUDFLARENET - Cloudflare, Inc., US')).toBe('Cloudflare, Inc.');
    expect(providerDisplayName('BTC-AS, BG')).toBe('BTC-AS');
    expect(providerDisplayName('Vivacom')).toBe('Vivacom');
  });

  it('summarizes the connection in one sentence key', () => {
    const base = {
      transport: 'wifi',
      hasInternet: true,
      isValidated: true,
      isCaptivePortal: false,
      signal: 'good' as const,
      latencies: [20, 25, 30],
    };
    expect(connectionSummary(base)).toBe('good');
    expect(connectionSummary({ ...base, transport: 'none' })).toBe('offline');
    expect(connectionSummary({ ...base, isCaptivePortal: true })).toBe('portal');
    expect(connectionSummary({ ...base, hasInternet: false })).toBe('no-internet');
    expect(connectionSummary({ ...base, isValidated: false })).toBe('checking');
    expect(connectionSummary({ ...base, signal: 'poor' })).toBe('weak-signal');
    expect(connectionSummary({ ...base, latencies: [180, 200, null] })).toBe('slow');
    expect(connectionSummary({ ...base, latencies: [null, null] })).toBe('good');
  });
});
