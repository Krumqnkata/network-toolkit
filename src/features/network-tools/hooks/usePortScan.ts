import { useCallback, useEffect, useRef, useState } from 'react';

import { chunk } from '../../../domain/algorithms/ports';
import { scanPorts, type PortResult } from '../../../native/lan';
import { logError, toAppError, type AppError } from '../../../utils/errors';

/** Ports per native call; one call is one selector round with a shared timeout. */
export const PORT_BATCH = 256;
export const PORT_TIMEOUT_MS = 1000;

export interface PortScanState {
  running: boolean;
  address: string | null;
  done: number;
  total: number;
  results: PortResult[];
  error: AppError | null;
  start: (host: string, ports: number[]) => void;
  stop: () => void;
}

export function usePortScan(): PortScanState {
  const [running, setRunning] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<PortResult[]>([]);
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

  const start = useCallback((host: string, ports: number[]) => {
    const id = ++runId.current;
    setRunning(true);
    setAddress(null);
    setDone(0);
    setTotal(ports.length);
    setResults([]);
    setError(null);

    const loop = async () => {
      for (const batch of chunk(ports, PORT_BATCH)) {
        try {
          const result = await scanPorts(host, batch, PORT_TIMEOUT_MS);
          if (id !== runId.current) return;
          setAddress(result.address);
          setResults(previous => [...previous, ...result.ports]);
          setDone(previous => previous + batch.length);
        } catch (caught) {
          logError('port-scan', caught);
          if (id !== runId.current) return;
          setError(toAppError(caught));
          setRunning(false);
          return;
        }
      }
      if (id === runId.current) setRunning(false);
    };
    loop();
  }, []);

  return { running, address, done, total, results, error, start, stop };
}
