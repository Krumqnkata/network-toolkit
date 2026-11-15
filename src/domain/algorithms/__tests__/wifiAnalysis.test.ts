import { network, scanNetworks } from '../../../../tests/fixtures/wifiScan';
import {
  appendHistory,
  channelSpan,
  channelToFrequency,
  congestionFor,
  interferenceWeight,
  isDfsChannel,
  loadLevel,
  networksInBand,
  parseSecurity,
  rankChannels,
  spansOverlap,
  supportsWps,
} from '../wifiAnalysis';

describe('parseSecurity', () => {
  it.each([
    ['[ESS]', 'open'],
    ['', 'open'],
    ['[WEP][ESS]', 'wep'],
    ['[WPA-PSK-TKIP][ESS]', 'wpa'],
    ['[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS][WPS]', 'wpa2'],
    ['[RSN-PSK+SAE-CCMP][ESS]', 'wpa2-wpa3'],
    ['[RSN-SAE-CCMP][ESS]', 'wpa3'],
    ['[RSN-OWE-CCMP][ESS]', 'owe'],
    ['[WPA2-EAP/SHA1-CCMP][RSN-EAP/SHA1-CCMP][ESS]', 'enterprise'],
  ])('%s → %s', (capabilities, expected) => {
    expect(parseSecurity(capabilities)).toBe(expected);
  });

  it('detects WPS', () => {
    expect(supportsWps('[WPA2-PSK-CCMP][ESS][WPS]')).toBe(true);
    expect(supportsWps('[WPA2-PSK-CCMP][ESS]')).toBe(false);
  });
});

describe('channelSpan', () => {
  it('uses the primary channel for 20 MHz networks', () => {
    const span = channelSpan(
      network({ frequencyMhz: 2437, channelWidthMhz: 20, centerFreq0Mhz: 0 }),
    );
    expect(span).toMatchObject({ band: '2.4', primaryChannel: 6, lowMhz: 2427, highMhz: 2447 });
  });

  it('uses centerFreq0 for wide channels', () => {
    // 80 MHz channel 36–48: primary 5180, center 5210.
    const span = channelSpan(
      network({ frequencyMhz: 5180, channelWidthMhz: 80, centerFreq0Mhz: 5210 }),
    );
    expect(span).toMatchObject({ band: '5', primaryChannel: 36, lowMhz: 5170, highMhz: 5250 });
  });

  it('falls back to 20 MHz when the width is unknown', () => {
    const span = channelSpan(
      network({ frequencyMhz: 5500, channelWidthMhz: null, centerFreq0Mhz: 0 }),
    );
    expect(span?.widthMhz).toBe(20);
  });

  it('returns null for non-Wi-Fi frequencies', () => {
    expect(channelSpan(network({ frequencyMhz: 900 }))).toBeNull();
  });
});

describe('spansOverlap', () => {
  const span = (frequencyMhz: number) =>
    channelSpan(network({ frequencyMhz, channelWidthMhz: 20, centerFreq0Mhz: 0 }))!;

  it('treats 1, 6 and 11 as non-overlapping', () => {
    expect(spansOverlap(span(2412), span(2437))).toBe(false);
    expect(spansOverlap(span(2437), span(2462))).toBe(false);
  });

  it('detects overlap between adjacent 2.4 GHz channels', () => {
    expect(spansOverlap(span(2412), span(2427))).toBe(true);
    expect(spansOverlap(span(2437), span(2447))).toBe(true);
  });

  it('never overlaps across bands', () => {
    expect(spansOverlap(span(5925 + 10), span(5915))).toBe(false);
  });
});

describe('interference and load', () => {
  it('weights stronger networks higher, clamped to 0–60', () => {
    expect(interferenceWeight(-95)).toBe(0);
    expect(interferenceWeight(-90)).toBe(0);
    expect(interferenceWeight(-60)).toBe(30);
    expect(interferenceWeight(-20)).toBe(60);
  });

  it('maps scores to load levels', () => {
    expect(loadLevel(0)).toBe('clear');
    expect(loadLevel(10)).toBe('light');
    expect(loadLevel(50)).toBe('moderate');
    expect(loadLevel(120)).toBe('busy');
  });
});

describe('channelToFrequency', () => {
  it('inverts frequencyToChannel for every band', () => {
    expect(channelToFrequency('2.4', 1)).toBe(2412);
    expect(channelToFrequency('2.4', 14)).toBe(2484);
    expect(channelToFrequency('5', 36)).toBe(5180);
    expect(channelToFrequency('5', 165)).toBe(5825);
    expect(channelToFrequency('6', 1)).toBe(5955);
    expect(channelToFrequency('6', 2)).toBe(5935);
    expect(channelToFrequency('60', 1)).toBeNull();
  });

  it('flags DFS channels', () => {
    expect(isDfsChannel(36)).toBe(false);
    expect(isDfsChannel(52)).toBe(true);
    expect(isDfsChannel(144)).toBe(true);
    expect(isDfsChannel(149)).toBe(false);
  });
});

describe('rankChannels', () => {
  it('prefers the 2.4 GHz channel nobody overlaps', () => {
    const networks = [
      network({ frequencyMhz: 2412, channelWidthMhz: 20, centerFreq0Mhz: 0, rssi: -50 }),
      network({
        bssid: 'b',
        frequencyMhz: 2437,
        channelWidthMhz: 20,
        centerFreq0Mhz: 0,
        rssi: -70,
      }),
    ];
    const ranking = rankChannels('2.4', networks);
    expect(ranking.map(r => r.channel)).toEqual([11, 6, 1]);
    expect(ranking[0]).toMatchObject({ channel: 11, score: 0, load: 'clear', networkCount: 0 });
    expect(ranking[2]).toMatchObject({ channel: 1, score: 40, networkCount: 1 });
  });

  it('accounts for wide channels and ranks non-DFS first on ties', () => {
    const wide = network({
      frequencyMhz: 5180,
      channelWidthMhz: 80,
      centerFreq0Mhz: 5210,
      rssi: -40,
    });
    const ranking = rankChannels('5', [wide]);
    const busy = ranking.filter(r => r.score > 0).map(r => r.channel);
    expect(busy.sort((a, b) => a - b)).toEqual([36, 40, 44, 48]);
    expect(ranking[0]).toMatchObject({ channel: 149, dfs: false, score: 0 });
    expect(ranking.find(r => r.channel === 52)?.dfs).toBe(true);
  });
});

describe('congestionFor', () => {
  it('counts other networks overlapping the target, excluding itself', () => {
    const target = network({
      bssid: 'me',
      frequencyMhz: 2437,
      channelWidthMhz: 20,
      centerFreq0Mhz: 0,
    });
    const neighbour = network({
      bssid: 'n1',
      frequencyMhz: 2442,
      channelWidthMhz: 20,
      centerFreq0Mhz: 0,
      rssi: -60,
    });
    const far = network({
      bssid: 'n2',
      frequencyMhz: 2412,
      channelWidthMhz: 20,
      centerFreq0Mhz: 0,
      rssi: -40,
    });
    expect(congestionFor(target, [target, neighbour, far])).toEqual({
      score: 30,
      load: 'moderate',
      overlapping: 1,
    });
  });
});

describe('networksInBand', () => {
  it('filters by band and sorts strongest first', () => {
    expect(networksInBand(scanNetworks, '2.4').map(n => n.rssi)).toEqual([-48, -71, -83]);
    expect(networksInBand(scanNetworks, '6').map(n => n.ssid)).toEqual(['Office 6E']);
  });
});

describe('appendHistory', () => {
  it('appends one sample per BSSID per scan and caps the length', () => {
    const a = network({ bssid: 'a', rssi: -50 });
    let history = appendHistory({}, 1, [a], 3);
    history = appendHistory(history, 1, [a], 3); // same scan, ignored
    history = appendHistory(history, 2, [{ ...a, rssi: -55 }], 3);
    history = appendHistory(history, 3, [{ ...a, rssi: -60 }], 3);
    history = appendHistory(history, 4, [{ ...a, rssi: -65 }], 3);
    expect(history.a?.map(s => s.rssi)).toEqual([-55, -60, -65]);
  });

  it('ignores networks without a BSSID and does not mutate the input', () => {
    const input = { x: [{ timestamp: 1, rssi: -70 }] };
    const output = appendHistory(input, 2, [network({ bssid: null })]);
    expect(output).toEqual(input);
    expect(output.x).not.toBe(input.x);
  });
});
