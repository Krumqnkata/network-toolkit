import { create } from 'zustand';

import type { TopologyHop } from '../domain/algorithms/topology';
import type { NetworkSnapshot } from '../domain/models/network';
import type { AppError } from '../utils/errors';

export type TopologyPhase = 'idle' | 'building' | 'done';

interface TopologyState {
  phase: TopologyPhase;
  snapshot: NetworkSnapshot | null;
  hops: TopologyHop[];
  gatewayRttMs: number | null;
  builtAt: number | null;
  error: AppError | null;
  /** Incremented to cancel a running build. */
  runId: number;
  update: (patch: Partial<Omit<TopologyState, 'update'>>) => void;
}

/** The map's measurements; LAN, Wi-Fi and Bluetooth results come from their own stores. */
export const useTopologyStore = create<TopologyState>()(set => ({
  phase: 'idle',
  snapshot: null,
  hops: [],
  gatewayRttMs: null,
  builtAt: null,
  error: null,
  runId: 0,
  update: patch => set(patch),
}));
