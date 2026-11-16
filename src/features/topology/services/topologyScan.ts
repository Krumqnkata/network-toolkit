import { isIPv4 } from '../../../domain/algorithms/ip';
import type { TopologyHop } from '../../../domain/algorithms/topology';
import { getNetworkSnapshot } from '../../../native/network';
import { ping } from '../../../native/netTools';
import { getCachedWifiScan } from '../../../native/wifi';
import { useLanStore } from '../../../stores/lanStore';
import { useTopologyStore } from '../../../stores/topologyStore';
import { useWifiScanStore } from '../../../stores/wifiScanStore';
import { logError, toAppError } from '../../../utils/errors';
import { startLanScan } from '../../lan-scanner/services/lanScan';

export const TRACE_TARGET = '1.1.1.1';
export const MAX_TRACE_HOPS = 15;
/** Stop tracing after this many hops in a row did not answer. */
export const MAX_SILENT_HOPS = 4;
const HOP_TIMEOUT_MS = 1500;

/** Lowest of a few pings: the link's own delay, without queueing spikes. */
async function bestRtt(host: string, count = 3): Promise<number | null> {
  let best: number | null = null;
  for (let i = 0; i < count; i++) {
    try {
      const probe = await ping(host, { family: 'ipv4', timeoutMs: 1000 });
      if (probe.status === 'reply' && probe.rttMs !== null) {
        best = best === null ? probe.rttMs : Math.min(best, probe.rttMs);
      }
    } catch (error) {
      logError('topology', error);
      return best;
    }
  }
  return best;
}

/**
 * Traceroute with TTL-limited pings; every router that answers is then pinged
 * directly for its round-trip time. Hops are published as they are found, so
 * the map grows while it is being built.
 */
async function trace(active: () => boolean): Promise<void> {
  const { update } = useTopologyStore.getState();
  const hops: TopologyHop[] = [];
  let silent = 0;
  for (let ttl = 1; ttl <= MAX_TRACE_HOPS; ttl++) {
    const probe = await ping(TRACE_TARGET, { family: 'ipv4', ttl, timeoutMs: HOP_TIMEOUT_MS });
    if (!active()) return;
    const hop: TopologyHop = {
      ttl,
      address: probe.from,
      rttMs: probe.status === 'reply' ? probe.rttMs : null,
      status: probe.status,
    };
    if (probe.status === 'ttl-exceeded' && probe.from) {
      hop.rttMs = await bestRtt(probe.from, 2);
      if (!active()) return;
    }
    hops.push(hop);
    update({ hops: [...hops] });
    if (probe.status === 'reply' || probe.status === 'unreachable') return;
    silent = probe.status === 'timeout' ? silent + 1 : 0;
    if (silent >= MAX_SILENT_HOPS) return;
  }
}

/** Measures everything the map shows. Re-running cancels the previous build. */
export async function buildTopologyMap(): Promise<void> {
  const store = useTopologyStore.getState();
  const runId = store.runId + 1;
  const active = () => useTopologyStore.getState().runId === runId;
  const update = store.update;
  update({ runId, phase: 'building', hops: [], gatewayRttMs: null, error: null });

  try {
    const snapshot = await getNetworkSnapshot();
    if (!active()) return;
    update({ snapshot });
    if (snapshot.transport === 'none') {
      update({ phase: 'done', builtAt: Date.now() });
      return;
    }

    const local = snapshot.transport !== 'cellular';
    const gateway = local ? snapshot.gateways.find(isIPv4) ?? null : null;
    const lan = useLanStore.getState();
    const scanning = lan.phase === 'probing' || lan.phase === 'naming';

    const tasks: Promise<unknown>[] = [trace(active)];
    if (gateway) {
      tasks.push(
        bestRtt(gateway).then(gatewayRttMs => {
          if (active()) update({ gatewayRttMs });
        }),
      );
    }
    if (snapshot.transport === 'wifi' && !useWifiScanStore.getState().result) {
      tasks.push(
        getCachedWifiScan()
          .then(result => useWifiScanStore.getState().setResult(result))
          .catch(error => logError('topology', error)),
      );
    }
    // The LAN scan fills `useLanStore`; the map redraws as devices appear.
    if (local && !scanning) {
      tasks.push(startLanScan().catch(error => logError('topology', error)));
    }
    await Promise.all(tasks);
    if (!active()) return;
    update({ phase: 'done', builtAt: Date.now() });
  } catch (error) {
    logError('topology', error);
    if (active()) update({ phase: 'done', error: toAppError(error) });
  }
}

export function cancelTopologyMap(): void {
  const { runId, phase, update } = useTopologyStore.getState();
  if (phase === 'building') update({ runId: runId + 1, phase: 'done' });
}
