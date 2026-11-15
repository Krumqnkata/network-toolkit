import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useEffect, useRef, useState } from 'react';

import { getNetworkSnapshot } from '../../../native/network';
import { getCachedWifiScan, scanWifi } from '../../../native/wifi';
import { useWifiScanStore } from '../../../stores/wifiScanStore';
import { logError, toAppError, type AppError } from '../../../utils/errors';

/**
 * Android lets a foreground app scan 4 times per 2 minutes (Android 9+).
 * One automatic scan every 30 s stays within that budget and leaves no
 * headroom wasted; manual scans beyond it return cached results.
 */
export const AUTO_SCAN_INTERVAL_MS = 30_000;

export interface WifiScannerState {
  scanning: boolean;
  needsPermission: boolean;
  error: AppError | null;
  scanNow: () => void;
  /** Re-check after the user granted the permission. */
  onPermissionGranted: () => void;
}

export function useWifiScanner(): WifiScannerState {
  const setResult = useWifiScanStore(state => state.setResult);
  const setConnectedBssid = useWifiScanStore(state => state.setConnectedBssid);
  const autoScan = useWifiScanStore(state => state.autoScan);
  const [scanning, setScanning] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [error, setError] = useState<AppError | null>(null);
  const inFlight = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refreshConnected = useCallback(async () => {
    try {
      const snapshot = await getNetworkSnapshot();
      if (mounted.current) setConnectedBssid(snapshot.wifi?.bssid ?? null);
    } catch (caught) {
      logError('wifi-scanner', caught);
    }
  }, [setConnectedBssid]);

  const run = useCallback(
    async (mode: 'cached' | 'scan') => {
      if (inFlight.current) return;
      inFlight.current = true;
      if (mode === 'scan') setScanning(true);
      try {
        const result = await (mode === 'scan' ? scanWifi() : getCachedWifiScan());
        if (!mounted.current) return;
        setResult(result);
        setNeedsPermission(false);
        setError(null);
      } catch (caught) {
        const appError = toAppError(caught);
        if (!mounted.current) return;
        if (appError.code === 'permission-denied') {
          setNeedsPermission(true);
        } else {
          logError('wifi-scanner', caught);
          setError(appError);
        }
      } finally {
        inFlight.current = false;
        if (mounted.current) setScanning(false);
      }
    },
    [setResult],
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        await refreshConnected();
        await run('cached');
        if (!cancelled) await run('scan');
      })();
      const interval = autoScan ? setInterval(() => run('scan'), AUTO_SCAN_INTERVAL_MS) : null;
      return () => {
        cancelled = true;
        if (interval) clearInterval(interval);
      };
    }, [autoScan, refreshConnected, run]),
  );

  const scanNow = useCallback(() => {
    run('scan');
  }, [run]);

  const onPermissionGranted = useCallback(() => {
    refreshConnected();
    run('scan');
  }, [refreshConnected, run]);

  return { scanning, needsPermission, error, scanNow, onPermissionGranted };
}
