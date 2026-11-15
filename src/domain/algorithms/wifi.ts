export type WifiBand = '2.4' | '5' | '6' | '60';

/** Maps a center frequency (MHz) to its IEEE 802.11 band. */
export function frequencyToBand(frequencyMhz: number): WifiBand | null {
  if (frequencyMhz >= 2400 && frequencyMhz < 2500) return '2.4';
  if (frequencyMhz >= 4900 && frequencyMhz < 5925) return '5';
  if (frequencyMhz >= 5925 && frequencyMhz <= 7125) return '6';
  if (frequencyMhz >= 58000 && frequencyMhz <= 71000) return '60';
  return null;
}

/** Maps a 20 MHz primary channel center frequency (MHz) to its channel number. */
export function frequencyToChannel(frequencyMhz: number): number | null {
  const band = frequencyToBand(frequencyMhz);
  switch (band) {
    case '2.4':
      if (frequencyMhz === 2484) return 14;
      return frequencyMhz >= 2412 && frequencyMhz <= 2472 ? (frequencyMhz - 2407) / 5 : null;
    case '5':
      if (frequencyMhz < 5000) return (frequencyMhz - 4000) / 5;
      return (frequencyMhz - 5000) / 5;
    case '6':
      if (frequencyMhz === 5935) return 2;
      return frequencyMhz >= 5955 ? (frequencyMhz - 5950) / 5 : null;
    case '60':
      return frequencyMhz >= 58320 ? (frequencyMhz - 56160) / 2160 : null;
    default:
      return null;
  }
}

export type SignalQuality = 'excellent' | 'good' | 'fair' | 'weak' | 'poor';

/** Qualitative signal rating used throughout the UI. Thresholds are in dBm. */
export function classifySignal(rssiDbm: number): SignalQuality {
  if (rssiDbm >= -50) return 'excellent';
  if (rssiDbm >= -60) return 'good';
  if (rssiDbm >= -70) return 'fair';
  if (rssiDbm >= -80) return 'weak';
  return 'poor';
}

/** Linear 0–100 % scale between -100 dBm and -50 dBm. */
export function signalPercent(rssiDbm: number): number {
  return Math.round(Math.min(100, Math.max(0, (rssiDbm + 100) * 2)));
}

/** Marketing names for android.net.wifi.ScanResult.WIFI_STANDARD_* values. */
const WIFI_STANDARDS: Record<number, string> = {
  1: '802.11a/b/g',
  4: 'Wi-Fi 4 (802.11n)',
  5: 'Wi-Fi 5 (802.11ac)',
  6: 'Wi-Fi 6 (802.11ax)',
  7: 'WiGig (802.11ad)',
  8: 'Wi-Fi 7 (802.11be)',
};

export function wifiStandardLabel(standard: number | null): string | null {
  if (standard === null) return null;
  return WIFI_STANDARDS[standard] ?? null;
}
