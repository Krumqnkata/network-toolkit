import { z } from 'zod';

import type { NetworkSnapshot } from '../domain/models/network';
import { AppError, toAppError } from '../utils/errors';
import NativeNetworkModule from './specs/NativeNetworkModule';

const ipAddressSchema = z.object({
  address: z.string().min(1),
  prefixLength: z.number().int().min(0).max(128),
  family: z.enum(['ipv4', 'ipv6']),
  scope: z.enum(['global', 'link-local', 'unique-local', 'loopback']),
});

const wifiLinkSchema = z.object({
  ssid: z.string().nullable(),
  bssid: z.string().nullable(),
  hiddenSsid: z.boolean(),
  rssi: z.number().int().nullable(),
  frequencyMhz: z.number().int().positive().nullable(),
  linkSpeedMbps: z.number().int().positive().nullable(),
  txLinkSpeedMbps: z.number().int().positive().nullable(),
  rxLinkSpeedMbps: z.number().int().positive().nullable(),
  maxTxLinkSpeedMbps: z.number().int().positive().nullable(),
  wifiStandard: z.number().int().nullable(),
  security: z
    .enum([
      'open',
      'wep',
      'wpa-personal',
      'wpa3-personal',
      'wpa-enterprise',
      'wpa3-enterprise',
      'wpa3-enterprise-192',
      'owe',
      'wapi',
      'passpoint',
    ])
    .nullable(),
});

export const networkSnapshotSchema = z.object({
  timestamp: z.number(),
  transport: z.enum(['wifi', 'cellular', 'ethernet', 'bluetooth', 'vpn', 'other', 'none']),
  isVpn: z.boolean(),
  hasInternet: z.boolean(),
  isValidated: z.boolean(),
  isCaptivePortal: z.boolean(),
  isMetered: z.boolean(),
  downstreamKbps: z.number().nullable(),
  upstreamKbps: z.number().nullable(),
  interfaceName: z.string().nullable(),
  addresses: z.array(ipAddressSchema),
  gateways: z.array(z.string()),
  dnsServers: z.array(z.string()),
  privateDnsActive: z.boolean().nullable(),
  privateDnsServer: z.string().nullable(),
  domains: z.string().nullable(),
  mtu: z.number().int().positive().nullable(),
  wifi: wifiLinkSchema.nullable(),
  cellularOperator: z.string().nullable(),
  cellularGeneration: z.enum(['5G', '4G', '3G', '2G']).nullable(),
  cellularDbm: z.number().int().nullable(),
  cellularLevel: z.number().int().min(0).max(4).nullable(),
  deviceName: z.string().nullable(),
  locationPermission: z.boolean(),
  locationEnabled: z.boolean(),
}) satisfies z.ZodType<NetworkSnapshot>;

/** Validates raw native output. Exported for tests. */
export function parseNetworkSnapshot(raw: unknown): NetworkSnapshot {
  const result = networkSnapshotSchema.safeParse(raw);
  if (!result.success) {
    throw new AppError(
      'invalid-native-data',
      `Unexpected network snapshot from native code: ${z.prettifyError(result.error)}`,
      result.error,
    );
  }
  return result.data;
}

export async function getNetworkSnapshot(): Promise<NetworkSnapshot> {
  let raw: unknown;
  try {
    raw = await NativeNetworkModule.getNetworkSnapshot();
  } catch (error) {
    throw toAppError(error);
  }
  return parseNetworkSnapshot(raw);
}
