import { frequencyToBand, frequencyToChannel } from '../../domain/algorithms/wifi';
import type { IpAddress, NetworkSnapshot } from '../../domain/models/network';

export type InternetStatus = 'ok' | 'captive-portal' | 'checking' | 'none';

/**
 * Android marks a network VALIDATED once its connectivity check succeeds. A
 * network with the INTERNET capability that is not (yet) validated is either
 * still being checked or has no working internet access.
 */
export function internetStatus(snapshot: NetworkSnapshot): InternetStatus | null {
  if (snapshot.transport === 'none') return null;
  if (snapshot.isCaptivePortal) return 'captive-portal';
  if (snapshot.isValidated) return 'ok';
  if (snapshot.hasInternet) return 'checking';
  return 'none';
}

export function formatAddress(address: IpAddress): string {
  return `${address.address}/${address.prefixLength}`;
}

/** IPv4 addresses, then routable IPv6 addresses; link-local IPv6 is hidden. */
export function displayAddresses(addresses: readonly IpAddress[]): {
  ipv4: string[];
  ipv6: string[];
} {
  return {
    ipv4: addresses.filter(a => a.family === 'ipv4').map(formatAddress),
    ipv6: addresses
      .filter(a => a.family === 'ipv6' && (a.scope === 'global' || a.scope === 'unique-local'))
      .map(formatAddress),
  };
}

export function formatBand(frequencyMhz: number | null): string | null {
  if (frequencyMhz === null) return null;
  const band = frequencyToBand(frequencyMhz);
  return band ? `${band} GHz` : null;
}

export function formatChannel(frequencyMhz: number | null): string | null {
  if (frequencyMhz === null) return null;
  const channel = frequencyToChannel(frequencyMhz);
  return channel === null ? null : String(channel);
}

export function formatMbps(value: number | null): string | null {
  return value === null ? null : `${value} Mbps`;
}

export function formatTxRx(tx: number | null, rx: number | null): string | null {
  if (tx === null && rx === null) return null;
  return `${tx ?? '—'} / ${rx ?? '—'} Mbps`;
}

export function formatKbps(kbps: number | null): string | null {
  if (kbps === null) return null;
  return kbps >= 1000 ? `${Math.round(kbps / 100) / 10} Mbps` : `${kbps} kbps`;
}

/** Why the SSID is missing, if it is — drives the permission notice. */
export function ssidBlocker(snapshot: NetworkSnapshot): 'permission' | 'location-off' | null {
  if (!snapshot.wifi || snapshot.wifi.ssid !== null) return null;
  if (!snapshot.locationPermission) return 'permission';
  if (!snapshot.locationEnabled) return 'location-off';
  return null;
}
