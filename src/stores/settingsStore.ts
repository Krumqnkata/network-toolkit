import { create } from 'zustand';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

interface SettingsState {
  themePreference: ThemePreference;
  setThemePreference: (preference: ThemePreference) => void;
}

/**
 * User settings. Held in memory for now; persistence moves to the SQLite
 * storage layer once it exists (see docs/ARCHITECTURE.md, "Storage").
 */
export const useSettingsStore = create<SettingsState>()(set => ({
  themePreference: 'system',
  setThemePreference: preference => set({ themePreference: preference }),
}));
