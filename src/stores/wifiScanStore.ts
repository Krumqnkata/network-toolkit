import { create } from 'zustand';

import { appendHistory, type RssiSample } from '../domain/algorithms/wifiAnalysis';
import type { WifiScanResult } from '../domain/models/wifiScan';

interface WifiScanState {
  result: WifiScanResult | null;
  /** Per-BSSID RSSI samples from this session's scans. */
  history: Record<string, RssiSample[]>;
  /** BSSID of the access point the phone is connected to, if known. */
  connectedBssid: string | null;
  autoScan: boolean;
  setResult: (result: WifiScanResult) => void;
  setConnectedBssid: (bssid: string | null) => void;
  setAutoScan: (enabled: boolean) => void;
}

export const useWifiScanStore = create<WifiScanState>()(set => ({
  result: null,
  history: {},
  connectedBssid: null,
  autoScan: true,
  setResult: result =>
    set(state => ({
      result,
      // Only fresh scans add history; cached results would duplicate samples.
      history: result.fresh
        ? appendHistory(state.history, result.timestamp, result.networks)
        : state.history,
    })),
  setConnectedBssid: connectedBssid => set({ connectedBssid }),
  setAutoScan: autoScan => set({ autoScan }),
}));
