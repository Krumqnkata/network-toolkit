import { useCallback, useEffect, useRef, useState } from 'react';

import { getNetworkSnapshot } from '../../../native/network';
import {
  cancelSpeedTest,
  getSpeedTestStatus,
  RUNNING_PHASES,
  startSpeedTest,
  type SpeedStatus,
} from '../../../native/speedTest';
import { useSpeedTestStore } from '../../../stores/speedTestStore';
import { logError, toAppError, type AppError } from '../../../utils/errors';

export const STATUS_INTERVAL_MS = 250;
export const PHASE_SECONDS = 10;
export const STREAMS = 4;

export interface SpeedTestState {
  status: SpeedStatus | null;
  running: boolean;
  error: AppError | null;
  start: () => void;
  cancel: () => void;
}

/** Starts the native test and reads its status 4× per second until it ends. */
export function useSpeedTest(): SpeedTestState {
  const [status, setStatus] = useState<SpeedStatus | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const addResult = useSpeedTestStore(state => state.addResult);
  const running = status !== null && RUNNING_PHASES.includes(status.phase);

  const stopPolling = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const poll = useCallback(() => {
    stopPolling();
    timer.current = setInterval(async () => {
      try {
        const next = await getSpeedTestStatus();
        setStatus(next);
        if (!RUNNING_PHASES.includes(next.phase)) {
          stopPolling();
          if (next.phase === 'done') {
            const finishedAt = Date.now();
            // The connection is saved with the result: the provider report sets weak-Wi-Fi tests apart.
            getNetworkSnapshot()
              .then(snapshot => ({
                transport: snapshot.transport,
                rssi: snapshot.wifi?.rssi ?? null,
              }))
              .catch(() => ({}))
              .then(link => addResult({ ...next, finishedAt, ...link }));
          }
        }
      } catch (caught) {
        logError('speed-test', caught);
        stopPolling();
        setError(toAppError(caught));
      }
    }, STATUS_INTERVAL_MS);
  }, [addResult, stopPolling]);

  // A test keeps running natively if the screen is left; pick it up again.
  useEffect(() => {
    getSpeedTestStatus()
      .then(current => {
        if (RUNNING_PHASES.includes(current.phase)) {
          setStatus(current);
          poll();
        }
      })
      .catch(caught => logError('speed-test', caught));
    return stopPolling;
  }, [poll, stopPolling]);

  const start = useCallback(async () => {
    setError(null);
    try {
      setStatus(await startSpeedTest(PHASE_SECONDS, STREAMS));
      poll();
    } catch (caught) {
      logError('speed-test', caught);
      setError(toAppError(caught));
    }
  }, [poll]);

  const cancel = useCallback(() => {
    cancelSpeedTest().catch(caught => logError('speed-test', caught));
  }, []);

  return { status, running, error, start, cancel };
}
