import { create } from 'zustand';

export interface LatencyTarget {
  id: string;
  /** Host to ping; null when unknown (e.g. no gateway). */
  host: string | null;
  label: string;
}

export interface PublicInfo {
  ip: string | null;
  provider: string | null;
  country: string | null;
  loadedAt: number;
}

interface HomeState {
  /** Latest round-trip time per target id (null = no reply). */
  latency: Record<string, number | null>;
  latencyLoading: boolean;
  publicInfo: PublicInfo | null;
  showPublicInfo: boolean;
  technicalOpen: boolean;
  set: (patch: Partial<Omit<HomeState, 'set'>>) => void;
}

export const useHomeStore = create<HomeState>()(set => ({
  latency: {},
  latencyLoading: false,
  publicInfo: null,
  showPublicInfo: true,
  technicalOpen: false,
  set: patch => set(patch),
}));
