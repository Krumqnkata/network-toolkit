import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '../../stores/settingsStore';
import { resolveColorScheme } from './resolveColorScheme';
import { themes, type Theme } from './themes';

const ThemeContext = createContext<Theme | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const preference = useSettingsStore(state => state.themePreference);
  const scheme = resolveColorScheme(preference, systemScheme);
  const theme = useMemo(() => themes[scheme], [scheme]);

  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be used inside <ThemeProvider>.');
  }
  return theme;
}
