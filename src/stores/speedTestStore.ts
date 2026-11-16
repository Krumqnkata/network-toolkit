import { create } from 'zustand';

import { speedResults, type SpeedResult } from '../database/repositories';
import type { StoredRecord } from '../database/storage';
import { logError } from '../utils/errors';

export type { SpeedResult };

/** How many past results the speed test screen shows. */
export const HISTORY_SIZE = 20;

interface SpeedTestState {
  results: StoredRecord<SpeedResult>[];
  loaded: boolean;
  load: () => Promise<void>;
  addResult: (result: SpeedResult) => Promise<void>;
  remove: (id: number) => Promise<void>;
  clear: () => Promise<void>;
}

/** Speed-test history, persisted in SQLite and cached here for the UI. */
export const useSpeedTestStore = create<SpeedTestState>()((set, get) => ({
  results: [],
  loaded: false,
  load: async () => {
    try {
      set({ results: await speedResults.list(HISTORY_SIZE), loaded: true });
    } catch (error) {
      logError('speed-history', error);
      set({ loaded: true });
    }
  },
  addResult: async result => {
    try {
      const record = await speedResults.add(result, result.finishedAt);
      set({ results: [record, ...get().results].slice(0, HISTORY_SIZE) });
    } catch (error) {
      logError('speed-history', error);
    }
  },
  remove: async id => {
    await speedResults.remove(id);
    set({ results: get().results.filter(record => record.id !== id) });
  },
  clear: async () => {
    await speedResults.clear();
    set({ results: [] });
  },
}));
