import { AppState } from 'react-native';
import { z } from 'zod';

import { getSetting, setSetting } from '../../../database/storage';
import { checksumFor, findUpdate, type GitHubRelease } from '../../../domain/algorithms/releases';
import { getNetworkSnapshot } from '../../../native/network';
import {
  canRequestInstalls,
  getDownloadStatus,
  getInstallInfo,
  getInstallStatus,
  installUpdate,
  openInstallSettings,
  startDownload,
} from '../../../native/update';
import { useUpdateStore } from '../../../stores/updateStore';
import { logError, toAppError } from '../../../utils/errors';

export const RELEASES_URL =
  'https://api.github.com/repos/Krumqnkata/network-toolkit/releases?per_page=15';
/** Automatic checks happen at most this often (on app start). */
export const CHECK_INTERVAL_MS = 6 * 3600_000;
const POLL_MS = 500;
const KEYS = { auto: 'update.auto', lastCheck: 'update.lastCheck' } as const;

const releaseSchema = z.object({
  tag_name: z.string(),
  draft: z.boolean(),
  prerelease: z.boolean(),
  html_url: z.string(),
  published_at: z.string().nullable(),
  body: z.string().nullable(),
  assets: z.array(
    z.object({ name: z.string(), browser_download_url: z.string(), size: z.number() }),
  ),
});

const store = () => useUpdateStore.getState();
const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

async function fetchText(url: string, accept: string, timeoutMs = 15_000): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { headers: { Accept: accept }, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
    return await response.text();
  } finally {
    clearTimeout(timer);
  }
}

export async function loadUpdateSettings(): Promise<void> {
  try {
    const [auto, lastCheck] = await Promise.all([
      getSetting(KEYS.auto),
      getSetting(KEYS.lastCheck),
    ]);
    store().set({
      autoUpdate: auto !== 'false',
      lastCheckedAt: lastCheck ? Number(lastCheck) || null : null,
    });
  } catch (error) {
    logError('update', error);
  }
}

export function setAutoUpdate(enabled: boolean): void {
  store().set({ autoUpdate: enabled });
  setSetting(KEYS.auto, String(enabled)).catch(error => logError('update', error));
}

/** Looks for a newer release on GitHub. Pre-releases count while a pre-release is installed. */
export async function checkForUpdates(): Promise<void> {
  const { phase } = store();
  if (phase === 'checking' || phase === 'downloading' || phase === 'installing') return;
  store().set({ phase: 'checking', error: null });
  try {
    const info = await getInstallInfo();
    store().set({ info });
    if (info.debuggable || !info.versionName) {
      store().set({ phase: 'unsupported', update: null });
      return;
    }
    const raw: unknown = JSON.parse(await fetchText(RELEASES_URL, 'application/vnd.github+json'));
    const releases = z.array(releaseSchema).parse(raw) as GitHubRelease[];
    const update = findUpdate(
      releases,
      info.versionName,
      info.abis,
      info.versionName.includes('-'),
    );
    const now = Date.now();
    store().set({ phase: update ? 'available' : 'up-to-date', update, lastCheckedAt: now });
    setSetting(KEYS.lastCheck, String(now)).catch(error => logError('update', error));
  } catch (error) {
    logError('update', error);
    store().set({ phase: 'error', error: toAppError(error).message });
  }
}

async function waitForDownload(): Promise<string> {
  for (;;) {
    await delay(POLL_MS);
    const status = await getDownloadStatus();
    if (status.state === 'downloading') {
      store().set({ progress: status.total > 0 ? status.bytes / status.total : 0 });
    } else if (status.state === 'done' && status.path) {
      store().set({ progress: 1 });
      return status.path;
    } else if (status.state === 'error') {
      throw new Error(status.error ?? 'Download failed');
    }
  }
}

let downloadedPath: string | null = null;

/** Hands the verified APK to Android; asks for "Install unknown apps" first if needed. */
export async function installDownloaded(): Promise<void> {
  if (!downloadedPath) return;
  if (!(await canRequestInstalls())) {
    store().set({ phase: 'needs-permission' });
    return;
  }
  store().set({ phase: 'installing', error: null });
  try {
    await installUpdate(downloadedPath);
    // On success Android replaces the app and restarts its process; otherwise
    // the status explains why (e.g. the user cancelled the confirmation).
    for (let i = 0; i < 120; i++) {
      await delay(POLL_MS);
      const status = await getInstallStatus();
      if (status.state === 'failure') throw new Error(status.message ?? 'Install failed');
      if (status.state === 'pending-user-action' || status.state === 'success') return;
    }
  } catch (error) {
    logError('update', error);
    store().set({ phase: 'error', error: toAppError(error).message });
  }
}

/** Downloads the available update, verifies its checksum and installs it. */
export async function downloadAndInstall(): Promise<void> {
  const { update, phase } = store();
  if (!update || phase === 'downloading' || phase === 'installing') return;
  store().set({ phase: 'downloading', progress: 0, error: null });
  try {
    const checksums = await fetchText(update.checksumsUrl, 'text/plain');
    const sha256 = checksumFor(checksums, update.apk.name);
    if (!sha256) throw new Error(`checksums.txt has no entry for ${update.apk.name}`);
    await startDownload(update.apk.browser_download_url, sha256, update.apk.name);
    downloadedPath = await waitForDownload();
  } catch (error) {
    logError('update', error);
    store().set({ phase: 'error', error: toAppError(error).message });
    return;
  }
  await installDownloaded();
}

export function requestInstallPermission(): void {
  openInstallSettings().catch(error => logError('update', error));
}

let appStateSubscribed = false;

/**
 * Startup routine: when automatic updates are on and the last check is older
 * than `CHECK_INTERVAL_MS`, checks GitHub and, off metered networks, downloads
 * and installs a newer version. On metered networks the update waits for the
 * user (home screen banner).
 */
export async function autoUpdateOnStart(): Promise<void> {
  await loadUpdateSettings();
  if (!appStateSubscribed) {
    appStateSubscribed = true;
    // Coming back from the "Install unknown apps" screen continues the install.
    AppState.addEventListener('change', next => {
      if (next === 'active' && store().phase === 'needs-permission') installDownloaded();
    });
  }
  const { autoUpdate, lastCheckedAt } = store();
  if (!autoUpdate) return;
  if (lastCheckedAt !== null && Date.now() - lastCheckedAt < CHECK_INTERVAL_MS) return;
  await checkForUpdates();
  if (store().phase !== 'available') return;
  try {
    if ((await getNetworkSnapshot()).isMetered) return;
  } catch (error) {
    logError('update', error);
    return;
  }
  await downloadAndInstall();
}
