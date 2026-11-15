import type { ScannedNetwork, WifiScanResult } from '../../src/domain/models/wifiScan';

const base: ScannedNetwork = {
  ssid: 'Home Network',
  bssid: 'aa:bb:cc:dd:ee:ff',
  rssi: -58,
  frequencyMhz: 5180,
  channelWidthMhz: 80,
  centerFreq0Mhz: 5210,
  centerFreq1Mhz: 0,
  capabilities: '[RSN-SAE-CCMP][ESS]',
  wifiStandard: 6,
  supportsRtt: false,
  passpoint: false,
  ageMs: 500,
};

export function network(overrides: Partial<ScannedNetwork>): ScannedNetwork {
  return { ...base, ...overrides };
}

export const scanNetworks: ScannedNetwork[] = [
  base,
  network({
    ssid: 'Home Network',
    bssid: 'aa:bb:cc:dd:ee:01',
    rssi: -48,
    frequencyMhz: 2437,
    channelWidthMhz: 20,
    centerFreq0Mhz: 0,
    capabilities: '[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS][WPS]',
    wifiStandard: 4,
  }),
  network({
    ssid: 'Neighbour',
    bssid: '11:22:33:44:55:66',
    rssi: -71,
    frequencyMhz: 2412,
    channelWidthMhz: 20,
    centerFreq0Mhz: 0,
    capabilities: '[WPA2-PSK-CCMP][ESS]',
    wifiStandard: 4,
  }),
  network({
    ssid: null,
    bssid: '77:88:99:aa:bb:cc',
    rssi: -83,
    frequencyMhz: 2462,
    channelWidthMhz: 20,
    centerFreq0Mhz: 0,
    capabilities: '[ESS]',
    wifiStandard: 1,
  }),
  network({
    ssid: 'Office 6E',
    bssid: 'de:ad:be:ef:00:01',
    rssi: -66,
    frequencyMhz: 5975,
    channelWidthMhz: 160,
    centerFreq0Mhz: 6025,
    capabilities: '[RSN-SAE-GCMP-256][ESS]',
    wifiStandard: 8,
  }),
];

export const scanResult: WifiScanResult = {
  timestamp: Date.UTC(2026, 10, 15, 18, 31, 0),
  scanStarted: true,
  fresh: true,
  wifiEnabled: true,
  locationEnabled: true,
  networks: scanNetworks,
};
