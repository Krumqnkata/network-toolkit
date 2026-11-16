import { useSettingsStore, type LanguagePreference } from '../stores/settingsStore';
import { bg } from './strings/bg';
import { en, type Strings } from './strings/en';

export type Language = 'en' | 'bg';
export type { Strings };

export const translations: Record<Language, Strings> = { en, bg };

/** BCP 47 locale used for number/date formatting per language. */
export const LOCALES: Record<Language, string> = { en: 'en-GB', bg: 'bg-BG' };

/** The device locale as reported by Hermes' Intl implementation. */
export function getDeviceLocale(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return 'en';
  }
}

export function resolveLanguage(preference: LanguagePreference, deviceLocale: string): Language {
  if (preference !== 'system') return preference;
  return deviceLocale.toLowerCase().startsWith('bg') ? 'bg' : 'en';
}

const deviceLocale = getDeviceLocale();

export function useLanguage(): Language {
  const preference = useSettingsStore(state => state.languagePreference);
  return resolveLanguage(preference, deviceLocale);
}

export function useStrings(): Strings {
  return translations[useLanguage()];
}

export function formatTime(timestamp: number, language: Language): string {
  return new Date(timestamp).toLocaleTimeString(LOCALES[language], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

export function formatDateTime(timestamp: number, language: Language): string {
  return new Date(timestamp).toLocaleString(LOCALES[language], {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}
