import type { ColorScheme } from './themes';
import type { ThemePreference } from '../../stores/settingsStore';

/**
 * Picks the effective color scheme from the user's preference and the scheme
 * reported by the OS. The OS may report `null`/`undefined` (or `unspecified`)
 * when it has no preference; dark is the app's default identity in that case.
 */
export function resolveColorScheme(
  preference: ThemePreference,
  systemScheme: string | null | undefined,
): ColorScheme {
  if (preference !== 'system') {
    return preference;
  }
  return systemScheme === 'light' ? 'light' : 'dark';
}
