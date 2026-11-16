import { create } from 'zustand';

import type { SpeedStatus } from '../native/speedTest';

export interface SpeedResult extends SpeedStatus {
  finishedAt: number;
}

/** Results of this session; persistent history arrives with SQLite (milestone 8). */
const MAX_RESULTS = 10;

interface SpeedTestState {
  results: SpeedResult[];
  addResult: (result: SpeedResult) => void;
}

export const useSpeedTestStore = create<SpeedTestState>()(set => ({
  results: [],
  addResult: result =>
    set(state => ({ results: [result, ...state.results].slice(0, MAX_RESULTS) })),
}));
