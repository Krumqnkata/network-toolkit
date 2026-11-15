import { create } from 'zustand';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const LANGUAGE_PREFERENCES = ['system', 'en', 'bg'] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

interface SettingsState {
  themePreference: ThemePreference;
  languagePreference: LanguagePreference;
  setThemePreference: (preference: ThemePreference) => void;
  setLanguagePreference: (preference: LanguagePreference) => void;
}

/**
 * User settings. Held in memory for now; persistence moves to the SQLite
 * storage layer once it exists (see docs/ARCHITECTURE.md, "Storage").
 */
export const useSettingsStore = create<SettingsState>()(set => ({
  themePreference: 'system',
  languagePreference: 'system',
  setThemePreference: preference => set({ themePreference: preference }),
  setLanguagePreference: preference => set({ languagePreference: preference }),
}));
