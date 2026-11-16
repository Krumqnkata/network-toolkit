import { create } from 'zustand';

import type { AvailableUpdate } from '../domain/algorithms/releases';
import type { InstallInfo } from '../native/update';

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'needs-permission'
  | 'installing'
  | 'unsupported'
  | 'error';

interface UpdateState {
  phase: UpdatePhase;
  update: AvailableUpdate | null;
  /** 0–1 while downloading. */
  progress: number;
  error: string | null;
  info: InstallInfo | null;
  autoUpdate: boolean;
  lastCheckedAt: number | null;
  set: (patch: Partial<Omit<UpdateState, 'set'>>) => void;
}

export const useUpdateStore = create<UpdateState>()(set => ({
  phase: 'idle',
  update: null,
  progress: 0,
  error: null,
  info: null,
  autoUpdate: true,
  lastCheckedAt: null,
  set: patch => set(patch),
}));
