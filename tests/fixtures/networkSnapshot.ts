import type { NetworkSnapshot } from '../../src/domain/models/network';

/** A typical home Wi-Fi connection with location permission granted. */
export const wifiSnapshot: NetworkSnapshot = {
  timestamp: Date.UTC(2026, 10, 15, 18, 30, 0),
  transport: 'wifi',
  isVpn: false,
  hasInternet: true,
  isValidated: true,
  isCaptivePortal: false,
  isMetered: false,
  downstreamKbps: 300000,
  upstreamKbps: 50000,
  interfaceName: 'wlan0',
  addresses: [
    { address: '192.168.1.23', prefixLength: 24, family: 'ipv4', scope: 'global' },
    { address: 'fe80::1c2d:3e4f', prefixLength: 64, family: 'ipv6', scope: 'link-local' },
    { address: '2001:db8::23', prefixLength: 64, family: 'ipv6', scope: 'global' },
  ],
  gateways: ['192.168.1.1'],
  dnsServers: ['192.168.1.1', '1.1.1.1'],
  privateDnsActive: false,
  privateDnsServer: null,
  domains: 'lan',
  mtu: 1500,
  wifi: {
    ssid: 'Home Network',
    bssid: 'aa:bb:cc:dd:ee:ff',
    hiddenSsid: false,
    rssi: -58,
    frequencyMhz: 5180,
    linkSpeedMbps: 866,
    txLinkSpeedMbps: 866,
    rxLinkSpeedMbps: 780,
    maxTxLinkSpeedMbps: 1201,
    wifiStandard: 6,
    security: 'wpa3-personal',
  },
  cellularOperator: null,
  locationPermission: true,
  locationEnabled: true,
};

/** Same connection, but Android withholds the SSID (no location permission). */
export const redactedWifiSnapshot: NetworkSnapshot = {
  ...wifiSnapshot,
  wifi: { ...wifiSnapshot.wifi!, ssid: null, bssid: null },
  locationPermission: false,
};

export const offlineSnapshot: NetworkSnapshot = {
  ...wifiSnapshot,
  transport: 'none',
  hasInternet: false,
  isValidated: false,
  isMetered: false,
  downstreamKbps: null,
  upstreamKbps: null,
  interfaceName: null,
  addresses: [],
  gateways: [],
  dnsServers: [],
  privateDnsActive: null,
  domains: null,
  mtu: null,
  wifi: null,
};
