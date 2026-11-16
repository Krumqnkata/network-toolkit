import { create } from 'zustand';

import { monitorSessions, type MonitorSample, type MonitorSession } from '../database/repositories';
import type { StoredRecord } from '../database/storage';
import { emptyAccumulator, type MonitorAccumulator } from '../domain/algorithms/monitor';
import { logError, type AppError } from '../utils/errors';

interface MonitorState {
  running: boolean;
  runId: number;
  target: string | null;
  /** Resolved address of the target. */
  address: string | null;
  startedAt: number | null;
  samples: MonitorSample[];
  accumulator: MonitorAccumulator;
  error: AppError | null;
  history: StoredRecord<MonitorSession>[];
  update: (patch: Partial<MonitorState>) => void;
  refreshHistory: () => Promise<void>;
  removeSession: (id: number) => Promise<void>;
}

export const useMonitorStore = create<MonitorState>()((set, get) => ({
  running: false,
  runId: 0,
  target: null,
  address: null,
  startedAt: null,
  samples: [],
  accumulator: emptyAccumulator(),
  error: null,
  history: [],
  update: patch => set(patch),
  refreshHistory: async () => {
    try {
      set({ history: await monitorSessions.list(20) });
    } catch (error) {
      logError('monitor', error);
    }
  },
  removeSession: async id => {
    await monitorSessions.remove(id);
    set({ history: get().history.filter(record => record.id !== id) });
  },
}));
