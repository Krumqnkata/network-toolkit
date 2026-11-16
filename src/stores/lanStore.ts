import { create } from 'zustand';

import type { LanDevice } from '../domain/algorithms/devices';
import type { AppError } from '../utils/errors';

export type LanScanPhase = 'idle' | 'probing' | 'naming' | 'identifying' | 'done';

export const isLanScanning = (phase: LanScanPhase) =>
  phase === 'probing' || phase === 'naming' || phase === 'identifying';

export interface LanScanInfo {
  cidr: string;
  truncated: boolean;
  localAddress: string;
  gateway: string | null;
  startedAt: number;
  finishedAt: number | null;
}

interface LanState {
  phase: LanScanPhase;
  /** 0–1 over the whole scan. */
  progress: number;
  devices: LanDevice[];
  info: LanScanInfo | null;
  error: AppError | null;
  /** Incremented to cancel a running scan. */
  runId: number;
  update: (patch: Partial<Omit<LanState, 'update'>>) => void;
}

/** Scan results live here so they survive leaving the scanner screen. */
export const useLanStore = create<LanState>()(set => ({
  phase: 'idle',
  progress: 0,
  devices: [],
  info: null,
  error: null,
  runId: 0,
  update: patch => set(patch),
}));
