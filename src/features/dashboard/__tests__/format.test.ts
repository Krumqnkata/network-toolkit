import {
  offlineSnapshot,
  redactedWifiSnapshot,
  wifiSnapshot,
} from '../../../../tests/fixtures/networkSnapshot';
import {
  displayAddresses,
  formatBand,
  formatChannel,
  formatKbps,
  formatTxRx,
  internetStatus,
  ssidBlocker,
} from '../format';

describe('internetStatus', () => {
  it('reports validated networks as OK', () => {
    expect(internetStatus(wifiSnapshot)).toBe('ok');
  });

  it('prioritizes captive portals', () => {
    expect(internetStatus({ ...wifiSnapshot, isCaptivePortal: true, isValidated: false })).toBe(
      'captive-portal',
    );
  });

  it('distinguishes "still checking" from "no internet"', () => {
    expect(internetStatus({ ...wifiSnapshot, isValidated: false })).toBe('checking');
    expect(internetStatus({ ...wifiSnapshot, isValidated: false, hasInternet: false })).toBe(
      'none',
    );
  });

  it('has no status without a network', () => {
    expect(internetStatus(offlineSnapshot)).toBeNull();
  });
});

describe('displayAddresses', () => {
  it('lists IPv4 and routable IPv6 addresses with prefix lengths', () => {
    expect(displayAddresses(wifiSnapshot.addresses)).toEqual({
      ipv4: ['192.168.1.23/24'],
      ipv6: ['2001:db8::23/64'],
    });
  });
});

describe('Wi-Fi formatting', () => {
  it('formats band and channel from frequency', () => {
    expect(formatBand(5180)).toBe('5 GHz');
    expect(formatChannel(5180)).toBe('36');
    expect(formatBand(null)).toBeNull();
    expect(formatChannel(3000)).toBeNull();
  });

  it('formats link speeds', () => {
    expect(formatTxRx(866, 780)).toBe('866 / 780 Mbps');
    expect(formatTxRx(null, 780)).toBe('— / 780 Mbps');
    expect(formatTxRx(null, null)).toBeNull();
    expect(formatKbps(300000)).toBe('300 Mbps');
    expect(formatKbps(1500)).toBe('1.5 Mbps');
    expect(formatKbps(512)).toBe('512 kbps');
  });
});

describe('ssidBlocker', () => {
  it('explains a missing SSID', () => {
    expect(ssidBlocker(redactedWifiSnapshot)).toBe('permission');
    expect(
      ssidBlocker({ ...redactedWifiSnapshot, locationPermission: true, locationEnabled: false }),
    ).toBe('location-off');
  });

  it('is null when the SSID is visible or there is no Wi-Fi', () => {
    expect(ssidBlocker(wifiSnapshot)).toBeNull();
    expect(ssidBlocker(offlineSnapshot)).toBeNull();
  });
});
