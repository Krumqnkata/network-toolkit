import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import type { NetworkSnapshot } from '../../../domain/models/network';
import { getNetworkSnapshot } from '../../../native/network';
import { logError, toAppError, type AppError } from '../../../utils/errors';

export interface NetworkSnapshotState {
  snapshot: NetworkSnapshot | null;
  error: AppError | null;
  loading: boolean;
  refreshing: boolean;
  refresh: () => void;
}

type LoadMode = 'initial' | 'refresh' | 'poll';

/**
 * Keeps a live network snapshot while the screen is focused: loads on focus,
 * polls every `pollIntervalMs` (RSSI and link speed change continuously) and
 * reloads when the app returns to the foreground. Polling stops when the
 * screen loses focus, so no work happens in the background.
 */
export function useNetworkSnapshot(pollIntervalMs = 3000): NetworkSnapshotState {
  const [snapshot, setSnapshot] = useState<NetworkSnapshot | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async (mode: LoadMode) => {
    if (inFlight.current) return;
    inFlight.current = true;
    if (mode === 'refresh') setRefreshing(true);
    try {
      const next = await getNetworkSnapshot();
      if (!mounted.current) return;
      setSnapshot(next);
      setError(null);
    } catch (caught) {
      logError('network-snapshot', caught);
      if (!mounted.current) return;
      setError(toAppError(caught));
    } finally {
      inFlight.current = false;
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load('initial');
      const interval = setInterval(() => load('poll'), pollIntervalMs);
      const subscription = AppState.addEventListener('change', state => {
        if (state === 'active') load('poll');
      });
      return () => {
        clearInterval(interval);
        subscription.remove();
      };
    }, [load, pollIntervalMs]),
  );

  const refresh = useCallback(() => {
    load('refresh');
  }, [load]);

  return { snapshot, error, loading, refreshing, refresh };
}
