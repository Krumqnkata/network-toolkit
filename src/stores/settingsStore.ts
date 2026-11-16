import { create } from 'zustand';

import { getSetting, setSetting } from '../database/storage';
import { logError } from '../utils/errors';

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export const LANGUAGE_PREFERENCES = ['system', 'en', 'bg'] as const;
export type LanguagePreference = (typeof LANGUAGE_PREFERENCES)[number];

const KEYS = { theme: 'theme', language: 'language' } as const;

interface SettingsState {
  themePreference: ThemePreference;
  languagePreference: LanguagePreference;
  setThemePreference: (preference: ThemePreference) => void;
  setLanguagePreference: (preference: LanguagePreference) => void;
}

function persist(key: string, value: string) {
  setSetting(key, value).catch(error => logError('settings', error));
}

/** User settings, persisted in SQLite (see `hydrateSettings`). */
export const useSettingsStore = create<SettingsState>()(set => ({
  themePreference: 'system',
  languagePreference: 'system',
  setThemePreference: preference => {
    set({ themePreference: preference });
    persist(KEYS.theme, preference);
  },
  setLanguagePreference: preference => {
    set({ languagePreference: preference });
    persist(KEYS.language, preference);
  },
}));

function oneOf<T extends string>(values: readonly T[], value: string | null): T | null {
  return values.find(candidate => candidate === value) ?? null;
}

/** Loads saved settings once at startup; unknown or missing values keep the defaults. */
export async function hydrateSettings(): Promise<void> {
  try {
    const [theme, language] = await Promise.all([
      getSetting(KEYS.theme),
      getSetting(KEYS.language),
    ]);
    const patch: Partial<SettingsState> = {};
    const savedTheme = oneOf(THEME_PREFERENCES, theme);
    const savedLanguage = oneOf(LANGUAGE_PREFERENCES, language);
    if (savedTheme) patch.themePreference = savedTheme;
    if (savedLanguage) patch.languagePreference = savedLanguage;
    useSettingsStore.setState(patch);
  } catch (error) {
    logError('settings', error);
  }
}
