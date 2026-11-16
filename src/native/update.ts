import { z } from 'zod';

import { toAppError } from '../utils/errors';
import { parseNative } from './netTools';
import NativeUpdateModule from './specs/NativeUpdateModule';

export const installInfoSchema = z.object({
  versionName: z.string().nullable(),
  versionCode: z.number(),
  abis: z.array(z.string()),
  sdkInt: z.number().int(),
  canRequestInstalls: z.boolean(),
  /** Android 12+: updates can be applied without a confirmation dialog. */
  silentUpdates: z.boolean(),
  debuggable: z.boolean(),
});
export type InstallInfo = z.infer<typeof installInfoSchema>;

export const downloadStatusSchema = z.object({
  state: z.enum(['idle', 'downloading', 'done', 'error']),
  bytes: z.number().nonnegative(),
  total: z.number().nonnegative(),
  path: z.string().nullable(),
  error: z.string().nullable(),
});
export type DownloadStatus = z.infer<typeof downloadStatusSchema>;

export const installStatusSchema = z.object({
  state: z.enum(['idle', 'installing', 'pending-user-action', 'success', 'failure']),
  message: z.string().nullable(),
});
export type InstallStatus = z.infer<typeof installStatusSchema>;

async function native<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    throw toAppError(error);
  }
}

export async function getInstallInfo(): Promise<InstallInfo> {
  return parseNative(
    installInfoSchema,
    await native(() => NativeUpdateModule.getInstallInfo()),
    'install info',
  );
}

export function startDownload(url: string, sha256: string, fileName: string): Promise<void> {
  return native(() => NativeUpdateModule.startDownload(url, sha256, fileName));
}

export async function getDownloadStatus(): Promise<DownloadStatus> {
  return parseNative(
    downloadStatusSchema,
    await native(() => NativeUpdateModule.getDownloadStatus()),
    'download status',
  );
}

export function canRequestInstalls(): Promise<boolean> {
  return native(() => NativeUpdateModule.canRequestInstalls());
}

export function openInstallSettings(): Promise<void> {
  return native(() => NativeUpdateModule.openInstallSettings());
}

export function installUpdate(path: string): Promise<void> {
  return native(() => NativeUpdateModule.install(path));
}

export async function getInstallStatus(): Promise<InstallStatus> {
  return parseNative(
    installStatusSchema,
    await native(() => NativeUpdateModule.getInstallStatus()),
    'install status',
  );
}
