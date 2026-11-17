import { z } from 'zod';

import { toAppError } from '../utils/errors';
import { parseNative } from './netTools';
import NativeSpeedTestModule from './specs/NativeSpeedTestModule';

const rate = z.number().nonnegative().nullable();

export const speedStatusSchema = z.object({
  phase: z.enum(['idle', 'latency', 'download', 'upload', 'done', 'cancelled', 'error']),
  progress: z.number().min(0).max(1),
  currentMbps: rate,
  downloadMbps: rate,
  uploadMbps: rate,
  idleLatencyMs: rate,
  jitterMs: rate,
  downloadLatencyMs: rate,
  uploadLatencyMs: rate,
  packetLossPercent: z.number().min(0).max(100).nullable(),
  bytesDownloaded: z.number().nonnegative(),
  bytesUploaded: z.number().nonnegative(),
  serverColo: z.string().nullable(),
  serverCity: z.string().nullable(),
  serverCountry: z.string().nullable(),
  error: z.string().nullable(),
});

export type SpeedStatus = z.infer<typeof speedStatusSchema>;
export type SpeedPhase = SpeedStatus['phase'];

export const RUNNING_PHASES: readonly SpeedPhase[] = ['latency', 'download', 'upload'];

async function call(fn: () => Promise<unknown>): Promise<SpeedStatus> {
  let raw: unknown;
  try {
    raw = await fn();
  } catch (error) {
    throw toAppError(error);
  }
  return parseNative(speedStatusSchema, raw, 'speed test');
}

export function startSpeedTest(phaseSeconds = 10, streams = 4): Promise<SpeedStatus> {
  return call(() => NativeSpeedTestModule.start(phaseSeconds, streams));
}

export function getSpeedTestStatus(): Promise<SpeedStatus> {
  return call(() => NativeSpeedTestModule.getStatus());
}

export async function cancelSpeedTest(): Promise<void> {
  try {
    await NativeSpeedTestModule.cancel();
  } catch (error) {
    throw toAppError(error);
  }
}

/** Hours between automatic background tests: 0 (off), 6, 12 or 24. */
export type SpeedSchedule = 0 | 6 | 12 | 24;

const asSchedule = (hours: number): SpeedSchedule =>
  hours === 6 || hours === 12 || hours === 24 ? hours : 0;

/** Schedules automatic tests on home Wi-Fi / Ethernet (unmetered, battery not low). */
export async function setSpeedSchedule(hours: SpeedSchedule): Promise<SpeedSchedule> {
  try {
    return asSchedule(await NativeSpeedTestModule.setSchedule(hours));
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getSpeedSchedule(): Promise<SpeedSchedule> {
  try {
    return asSchedule(await NativeSpeedTestModule.getSchedule());
  } catch (error) {
    throw toAppError(error);
  }
}
