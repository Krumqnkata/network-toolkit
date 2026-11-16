import { useCallback, useEffect, useRef, useState } from 'react';

import type { PingSample } from '../../../domain/algorithms/ping';
import type { AddressFamily, PingProbe } from '../../../domain/models/netTools';
import { ping } from '../../../native/netTools';
import { logError, toAppError, type AppError } from '../../../utils/errors';
import { delay } from './useToolTask';

export const PING_INTERVAL_MS = 1000;
export const PING_TIMEOUT_MS = 2000;
/** Continuous mode keeps a rolling window of this many probes. */
export const MAX_PING_SAMPLES = 500;

export interface PingState {
  running: boolean;
  samples: PingSample[];
  /** Most recent probe; tells which address and method were used. */
  lastProbe: PingProbe | null;
  error: AppError | null;
  /** `count` = 0 pings until stopped. */
  start: (host: string, family: AddressFamily, count: number) => void;
  stop: () => void;
}

export function usePing(): PingState {
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<PingSample[]>([]);
  const [lastProbe, setLastProbe] = useState<PingProbe | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const runId = useRef(0);

  useEffect(
    () => () => {
      runId.current += 1;
    },
    [],
  );

  const stop = useCallback(() => {
    runId.current += 1;
    setRunning(false);
  }, []);

  const start = useCallback((host: string, family: AddressFamily, count: number) => {
    const id = ++runId.current;
    setSamples([]);
    setLastProbe(null);
    setError(null);
    setRunning(true);

    const loop = async () => {
      for (let seq = 1; count === 0 || seq <= count; seq++) {
        const started = Date.now();
        try {
          const probe = await ping(host, { family, timeoutMs: PING_TIMEOUT_MS });
          if (id !== runId.current) return;
          setLastProbe(probe);
          setSamples(previous => {
            const next = [
              ...previous,
              { seq, status: probe.status, rttMs: probe.rttMs, ttl: probe.ttl, timestamp: started },
            ];
            return next.length > MAX_PING_SAMPLES ? next.slice(-MAX_PING_SAMPLES) : next;
          });
        } catch (caught) {
          logError('ping', caught);
          if (id !== runId.current) return;
          setError(toAppError(caught));
          setRunning(false);
          return;
        }
        if (count !== 0 && seq === count) break;
        const wait = PING_INTERVAL_MS - (Date.now() - started);
        if (wait > 0) await delay(wait);
        if (id !== runId.current) return;
      }
      if (id === runId.current) setRunning(false);
    };
    loop();
  }, []);

  return { running, samples, lastProbe, error, start, stop };
}
