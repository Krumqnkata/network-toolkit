import { getSetting, setSetting } from '../../../database/storage';
import { providerDisplayName } from '../../../domain/algorithms/plain';
import { ping } from '../../../native/netTools';
import { useHomeStore, type LatencyTarget } from '../../../stores/homeStore';
import { logError } from '../../../utils/errors';
import { lookupPublicIp } from '../../network-tools/services/ipInfo';

/** Popular sites for the latency row. Plain names, no brand logos. */
export const SITE_TARGETS: readonly LatencyTarget[] = [
  { id: 'google', host: 'google.com', label: 'google.com' },
  { id: 'youtube', host: 'youtube.com', label: 'youtube.com' },
  { id: 'cloudflare', host: 'cloudflare.com', label: 'cloudflare.com' },
];

/** Public IP lookups are repeated at most this often. */
export const PUBLIC_INFO_TTL_MS = 30 * 60_000;
const SETTING = 'home.publicInfo';

/**
 * Background probes of the home screen (latency row, public IP). Jest turns
 * them off so that tool tests only see their own native calls.
 */
export const homeProbes = { enabled: true };

let latencyRun = 0;

/** Pings every target once, in parallel, and stores the results. */
export async function refreshLatency(targets: readonly LatencyTarget[]): Promise<void> {
  if (!homeProbes.enabled) return;
  const run = ++latencyRun;
  useHomeStore.getState().set({ latencyLoading: true });
  const results = await Promise.all(
    targets.map(async target => {
      if (!target.host) return [target.id, null] as const;
      try {
        const probe = await ping(target.host, { timeoutMs: 2000 });
        return [target.id, probe.status === 'reply' ? probe.rttMs : null] as const;
      } catch (error) {
        logError('home-latency', error);
        return [target.id, null] as const;
      }
    }),
  );
  if (run !== latencyRun) return;
  useHomeStore.getState().set({ latency: Object.fromEntries(results), latencyLoading: false });
}

export async function loadHomeSettings(): Promise<void> {
  try {
    const value = await getSetting(SETTING);
    useHomeStore.getState().set({ showPublicInfo: value !== 'false' });
  } catch (error) {
    logError('home', error);
  }
}

export function setShowPublicInfo(enabled: boolean): void {
  useHomeStore.getState().set({ showPublicInfo: enabled, publicInfo: null });
  setSetting(SETTING, String(enabled)).catch(error => logError('home', error));
}

let publicRequest: Promise<void> | null = null;

/**
 * Public IP and provider for the connection diagram (Cloudflare trace plus
 * Team Cymru, the same sources as the IP Information tool). Cached for
 * `PUBLIC_INFO_TTL_MS`; `force` refreshes after a network change.
 */
export function refreshPublicInfo(force = false): Promise<void> {
  const { showPublicInfo, publicInfo } = useHomeStore.getState();
  if (!showPublicInfo || !homeProbes.enabled) return Promise.resolve();
  if (!force && publicInfo && Date.now() - publicInfo.loadedAt < PUBLIC_INFO_TTL_MS) {
    return Promise.resolve();
  }
  if (publicRequest) return publicRequest;
  publicRequest = (async () => {
    try {
      const result = await lookupPublicIp(6000);
      const address = result.ipv4 ?? result.ipv6;
      useHomeStore.getState().set({
        publicInfo: {
          ip: address?.ip ?? null,
          provider: address?.origin?.name ? providerDisplayName(address.origin.name) : null,
          country: address?.country ?? null,
          loadedAt: Date.now(),
        },
      });
    } catch (error) {
      logError('home-public-ip', error);
    } finally {
      publicRequest = null;
    }
  })();
  return publicRequest;
}
