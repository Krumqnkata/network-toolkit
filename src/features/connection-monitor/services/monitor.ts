import {
  MAX_STORED_SAMPLES,
  monitorSessions,
  type MonitorSample,
  type MonitorSession,
} from '../../../database/repositories';
import {
  accumulate,
  downsample,
  emptyAccumulator,
  statsOf,
} from '../../../domain/algorithms/monitor';
import { ping } from '../../../native/netTools';
import { useMonitorStore } from '../../../stores/monitorStore';
import { logError, toAppError } from '../../../utils/errors';

export const MONITOR_INTERVAL_MS = 2000;
export const MONITOR_TIMEOUT_MS = 1500;
/** Samples kept in memory for the live chart and the saved session (~1 h). */
export const MAX_LIVE_SAMPLES = 1800;
/** The session record is rewritten this often while monitoring. */
export const SAVE_EVERY_MS = 30_000;

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export function toSession(
  target: string,
  startedAt: number,
  endedAt: number | null,
  samples: MonitorSample[],
  acc: ReturnType<typeof emptyAccumulator>,
): MonitorSession {
  const stats = statsOf(acc);
  return {
    target,
    startedAt,
    endedAt,
    intervalMs: MONITOR_INTERVAL_MS,
    sent: stats.sent,
    received: stats.received,
    minMs: stats.minMs,
    avgMs: stats.avgMs,
    maxMs: stats.maxMs,
    jitterMs: stats.jitterMs,
    outages: acc.outages,
    samples: downsample(samples, MAX_STORED_SAMPLES),
  };
}

export function stopMonitor(): void {
  const { runId, running, update } = useMonitorStore.getState();
  if (running) update({ runId: runId + 1, running: false });
}

/**
 * Pings `target` every 2 s until stopped, tracking latency, loss and outages
 * (3+ consecutive losses). Runs while the app is open; the session is saved to
 * SQLite every 30 s and when it stops.
 */
export async function startMonitor(target: string): Promise<void> {
  const store = useMonitorStore.getState();
  if (store.running) return;
  const runId = store.runId + 1;
  const active = () => useMonitorStore.getState().runId === runId;
  const startedAt = Date.now();
  let acc = emptyAccumulator();
  let samples: MonitorSample[] = [];
  store.update({
    runId,
    running: true,
    target,
    startedAt,
    samples: [],
    accumulator: acc,
    error: null,
    address: null,
  });

  let recordId: number | null = null;
  let lastSave = startedAt;
  const save = async (endedAt: number | null) => {
    const session = toSession(target, startedAt, endedAt, samples, acc);
    try {
      if (recordId === null) recordId = (await monitorSessions.add(session, startedAt)).id;
      else await monitorSessions.update(recordId, session);
    } catch (error) {
      logError('monitor', error);
    }
  };
  await save(null);

  while (active()) {
    const t = Date.now();
    let rtt: number | null = null;
    try {
      const probe = await ping(target, { timeoutMs: MONITOR_TIMEOUT_MS });
      if (probe.status === 'reply') rtt = probe.rttMs;
      if (active()) useMonitorStore.getState().update({ address: probe.address });
    } catch (error) {
      // A missing host or permission is not a network outage: stop with an error.
      const appError = toAppError(error);
      if (appError.code === 'unknown-host' || appError.code === 'invalid-input') {
        if (active()) useMonitorStore.getState().update({ running: false, error: appError });
        break;
      }
      logError('monitor', error);
    }
    if (!active()) break;
    const sample = { t, rtt };
    acc = accumulate(acc, sample, MONITOR_INTERVAL_MS);
    samples = [...samples, sample].slice(-MAX_LIVE_SAMPLES);
    useMonitorStore.getState().update({ samples, accumulator: acc });
    if (Date.now() - lastSave >= SAVE_EVERY_MS) {
      lastSave = Date.now();
      save(null);
    }
    const wait = MONITOR_INTERVAL_MS - (Date.now() - t);
    if (wait > 0) await delay(wait);
  }
  await save(Date.now());
  useMonitorStore.getState().refreshHistory();
}
