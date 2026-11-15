import { z } from 'zod';

import type { WifiScanResult } from '../domain/models/wifiScan';
import { AppError, toAppError } from '../utils/errors';
import NativeWifiModule from './specs/NativeWifiModule';

const scannedNetworkSchema = z.object({
  ssid: z.string().nullable(),
  bssid: z.string().nullable(),
  rssi: z.number().int(),
  frequencyMhz: z.number().int().positive(),
  channelWidthMhz: z.number().int().positive().nullable(),
  centerFreq0Mhz: z.number().int().nonnegative(),
  centerFreq1Mhz: z.number().int().nonnegative(),
  capabilities: z.string(),
  wifiStandard: z.number().int().nullable(),
  supportsRtt: z.boolean(),
  passpoint: z.boolean(),
  ageMs: z.number().nonnegative(),
});

export const wifiScanResultSchema = z.object({
  timestamp: z.number(),
  scanStarted: z.boolean(),
  fresh: z.boolean(),
  wifiEnabled: z.boolean(),
  locationEnabled: z.boolean(),
  networks: z.array(scannedNetworkSchema),
}) satisfies z.ZodType<WifiScanResult>;

export function parseWifiScanResult(raw: unknown): WifiScanResult {
  const result = wifiScanResultSchema.safeParse(raw);
  if (!result.success) {
    throw new AppError(
      'invalid-native-data',
      `Unexpected scan result from native code: ${z.prettifyError(result.error)}`,
      result.error,
    );
  }
  return result.data;
}

async function call(fn: () => Promise<unknown>): Promise<WifiScanResult> {
  let raw: unknown;
  try {
    raw = await fn();
  } catch (error) {
    throw toAppError(error);
  }
  return parseWifiScanResult(raw);
}

/** Requests a fresh scan (subject to Android's throttling) and returns the results. */
export function scanWifi(): Promise<WifiScanResult> {
  return call(() => NativeWifiModule.scan());
}

/** Returns the latest results Android has, without starting a scan. */
export function getCachedWifiScan(): Promise<WifiScanResult> {
  return call(() => NativeWifiModule.getCachedScanResults());
}
