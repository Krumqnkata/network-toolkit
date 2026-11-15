import { DarkTheme, DefaultTheme, type Theme as NavigationTheme } from '@react-navigation/native';

import type { Theme } from '../theme';

/** Maps the app theme onto React Navigation's theme shape. */
export function toNavigationTheme(theme: Theme): NavigationTheme {
  const base = theme.scheme === 'dark' ? DarkTheme : DefaultTheme;
  return {
    ...base,
    dark: theme.scheme === 'dark',
    colors: {
      ...base.colors,
      primary: theme.colors.accent,
      background: theme.colors.background,
      card: theme.colors.tabBar,
      text: theme.colors.textPrimary,
      border: theme.colors.border,
      notification: theme.colors.danger,
    },
  };
}
