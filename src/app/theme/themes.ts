import { palette, radius, spacing, typography } from './tokens';

export type ColorScheme = 'light' | 'dark';

export interface ThemeColors {
  /** App background behind every screen. */
  background: string;
  /** Cards, sheets and grouped lists. */
  surface: string;
  /** Elements placed on top of a surface (inputs, pressed rows). */
  surfaceRaised: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  /** Brand accent used for interactive elements and highlights. */
  accent: string;
  /** Text/icon color placed on top of `accent`. */
  onAccent: string;
  /** Low-emphasis tinted background for accent elements. */
  accentMuted: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  tabBar: string;
  tabInactive: string;
}

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

const darkColors: ThemeColors = {
  background: palette.ink950,
  surface: palette.ink900,
  surfaceRaised: palette.ink800,
  border: palette.ink700,
  textPrimary: palette.ink50,
  textSecondary: palette.ink200,
  textMuted: palette.ink400,
  accent: palette.signal400,
  onAccent: palette.signal950,
  accentMuted: '#0B2B2A',
  success: palette.green400,
  warning: palette.amber400,
  danger: palette.red400,
  info: palette.blue400,
  tabBar: palette.ink900,
  tabInactive: palette.ink400,
};

const lightColors: ThemeColors = {
  background: palette.ink50,
  surface: palette.white,
  surfaceRaised: palette.ink100,
  border: palette.ink100,
  textPrimary: palette.ink900,
  textSecondary: palette.ink600,
  textMuted: palette.ink500,
  accent: palette.signal700,
  onAccent: palette.white,
  accentMuted: palette.signal50,
  success: palette.green700,
  warning: palette.amber700,
  danger: palette.red700,
  info: palette.blue700,
  tabBar: palette.white,
  tabInactive: palette.ink500,
};

const shared = { spacing, radius, typography };

export const darkTheme: Theme = { scheme: 'dark', colors: darkColors, ...shared };
export const lightTheme: Theme = {
  scheme: 'light',
  colors: lightColors,
  ...shared,
};

export const themes: Record<ColorScheme, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};
