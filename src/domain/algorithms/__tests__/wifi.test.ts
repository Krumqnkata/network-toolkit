import {
  classifySignal,
  frequencyToBand,
  frequencyToChannel,
  signalPercent,
  wifiStandardLabel,
} from '../wifi';

describe('frequencyToBand', () => {
  it.each([
    [2412, '2.4'],
    [2484, '2.4'],
    [5180, '5'],
    [5885, '5'],
    [4920, '5'],
    [5935, '6'],
    [5955, '6'],
    [7115, '6'],
    [58320, '60'],
  ])('%i MHz is in the %s GHz band', (frequency, band) => {
    expect(frequencyToBand(frequency)).toBe(band);
  });

  it('returns null outside Wi-Fi bands', () => {
    expect(frequencyToBand(900)).toBeNull();
    expect(frequencyToBand(3600)).toBeNull();
  });
});

describe('frequencyToChannel', () => {
  it.each([
    [2412, 1],
    [2437, 6],
    [2462, 11],
    [2472, 13],
    [2484, 14],
    [5180, 36],
    [5500, 100],
    [5825, 165],
    [4920, 184],
    [5935, 2],
    [5955, 1],
    [6115, 33],
    [7115, 233],
    [58320, 1],
    [60480, 2],
  ])('%i MHz is channel %i', (frequency, channel) => {
    expect(frequencyToChannel(frequency)).toBe(channel);
  });

  it('returns null for frequencies that are not channel centers', () => {
    expect(frequencyToChannel(2400)).toBeNull();
    expect(frequencyToChannel(5940)).toBeNull();
    expect(frequencyToChannel(1000)).toBeNull();
  });
});

describe('signal classification', () => {
  it.each([
    [-40, 'excellent'],
    [-50, 'excellent'],
    [-55, 'good'],
    [-60, 'good'],
    [-67, 'fair'],
    [-75, 'weak'],
    [-80, 'weak'],
    [-90, 'poor'],
  ])('%i dBm is %s', (rssi, quality) => {
    expect(classifySignal(rssi)).toBe(quality);
  });

  it('maps dBm to a clamped 0–100 percentage', () => {
    expect(signalPercent(-30)).toBe(100);
    expect(signalPercent(-50)).toBe(100);
    expect(signalPercent(-75)).toBe(50);
    expect(signalPercent(-100)).toBe(0);
    expect(signalPercent(-120)).toBe(0);
  });
});

describe('wifiStandardLabel', () => {
  it('names known Android Wi-Fi standards', () => {
    expect(wifiStandardLabel(4)).toBe('Wi-Fi 4 (802.11n)');
    expect(wifiStandardLabel(6)).toBe('Wi-Fi 6 (802.11ax)');
    expect(wifiStandardLabel(8)).toBe('Wi-Fi 7 (802.11be)');
  });

  it('returns null for unknown or missing values', () => {
    expect(wifiStandardLabel(null)).toBeNull();
    expect(wifiStandardLabel(0)).toBeNull();
    expect(wifiStandardLabel(42)).toBeNull();
  });
});
