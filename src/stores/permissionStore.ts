import { create } from 'zustand';

/**
 * `unknown`  – not requested in this session.
 * `denied`   – denied, may be asked again.
 * `blocked`  – "Don't ask again"; only the system settings can change it.
 */
export type PermissionState = 'unknown' | 'granted' | 'denied' | 'blocked';

interface PermissionStoreState {
  location: PermissionState;
  setLocation: (state: PermissionState) => void;
  /** Android 17+ local network access ("Nearby devices"). */
  localNetwork: PermissionState;
  setLocalNetwork: (state: PermissionState) => void;
}

/** Central record of runtime permission outcomes, shared by every feature. */
export const usePermissionStore = create<PermissionStoreState>()(set => ({
  location: 'unknown',
  setLocation: location => set({ location }),
  localNetwork: 'unknown',
  setLocalNetwork: localNetwork => set({ localNetwork }),
}));
