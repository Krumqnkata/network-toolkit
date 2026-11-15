export interface ScannedNetwork {
  /** Null for hidden networks. */
  ssid: string | null;
  bssid: string | null;
  rssi: number;
  /** Primary 20 MHz channel center. */
  frequencyMhz: number;
  channelWidthMhz: number | null;
  /** Center of the whole channel for widths above 20 MHz (0 when not reported). */
  centerFreq0Mhz: number;
  /** Center of the second segment for 80+80 MHz (0 otherwise). */
  centerFreq1Mhz: number;
  /** Raw capability string, e.g. "[WPA2-PSK-CCMP][RSN-PSK-CCMP][ESS][WPS]". */
  capabilities: string;
  wifiStandard: number | null;
  supportsRtt: boolean;
  passpoint: boolean;
  /** How old the measurement is. */
  ageMs: number;
}

export interface WifiScanResult {
  timestamp: number;
  /** False when Android throttled or refused the scan request. */
  scanStarted: boolean;
  /** True when these results come from the scan just requested. */
  fresh: boolean;
  wifiEnabled: boolean;
  locationEnabled: boolean;
  networks: ScannedNetwork[];
}
