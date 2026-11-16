export type TransportType =
  | 'wifi'
  | 'cellular'
  | 'ethernet'
  | 'bluetooth'
  | 'vpn'
  | 'other'
  | 'none';

export interface IpAddress {
  address: string;
  prefixLength: number;
  family: 'ipv4' | 'ipv6';
  scope: 'global' | 'link-local' | 'unique-local' | 'loopback';
}

export type WifiSecurity =
  | 'open'
  | 'wep'
  | 'wpa-personal'
  | 'wpa3-personal'
  | 'wpa-enterprise'
  | 'wpa3-enterprise'
  | 'wpa3-enterprise-192'
  | 'owe'
  | 'wapi'
  | 'passpoint';

export interface WifiLink {
  /** Null when Android withholds it (no location permission or location off). */
  ssid: string | null;
  bssid: string | null;
  hiddenSsid: boolean;
  rssi: number | null;
  frequencyMhz: number | null;
  linkSpeedMbps: number | null;
  txLinkSpeedMbps: number | null;
  rxLinkSpeedMbps: number | null;
  maxTxLinkSpeedMbps: number | null;
  /** android.net.wifi.ScanResult.WIFI_STANDARD_* (Android 11+). */
  wifiStandard: number | null;
  /** Android 12+. */
  security: WifiSecurity | null;
}

export interface NetworkSnapshot {
  timestamp: number;
  transport: TransportType;
  isVpn: boolean;
  hasInternet: boolean;
  isValidated: boolean;
  isCaptivePortal: boolean;
  isMetered: boolean;
  downstreamKbps: number | null;
  upstreamKbps: number | null;
  interfaceName: string | null;
  addresses: IpAddress[];
  gateways: string[];
  dnsServers: string[];
  privateDnsActive: boolean | null;
  privateDnsServer: string | null;
  domains: string | null;
  mtu: number | null;
  wifi: WifiLink | null;
  cellularOperator: string | null;
  /** Newest radio generation in the signal report (Android 10+). */
  cellularGeneration: '5G' | '4G' | '3G' | '2G' | null;
  cellularDbm: number | null;
  /** Android's 0–4 signal level (Android 9+). */
  cellularLevel: number | null;
  /** Device name from the system settings, or the model. */
  deviceName: string | null;
  locationPermission: boolean;
  locationEnabled: boolean;
}
