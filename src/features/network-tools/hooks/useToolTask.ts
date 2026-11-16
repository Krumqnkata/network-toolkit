import { useCallback, useEffect, useRef, useState } from 'react';

import { logError, toAppError, type AppError } from '../../../utils/errors';

export interface ToolTaskState<T> {
  running: boolean;
  result: T | null;
  error: AppError | null;
  run: (task: () => Promise<T>) => Promise<void>;
}

/**
 * Runs one asynchronous tool request at a time. A newer run, or unmounting,
 * makes the results of older runs be ignored.
 */
export function useToolTask<T>(): ToolTaskState<T> {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<T | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const runId = useRef(0);

  useEffect(
    () => () => {
      runId.current += 1;
    },
    [],
  );

  const run = useCallback(async (task: () => Promise<T>) => {
    const id = ++runId.current;
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const value = await task();
      if (id !== runId.current) return;
      setResult(value);
    } catch (caught) {
      logError('tool', caught);
      if (id !== runId.current) return;
      setError(toAppError(caught));
    } finally {
      if (id === runId.current) setRunning(false);
    }
  }, []);

  return { running, result, error, run };
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
