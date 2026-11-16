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

export interface ChartColors {
  /** Categorical colors for data series (networks, devices), in display order. */
  series: readonly string[];
  grid: string;
}

export interface Theme {
  scheme: ColorScheme;
  colors: ThemeColors;
  chart: ChartColors;
  spacing: typeof spacing;
  radius: typeof radius;
  typography: typeof typography;
}

const darkColors: ThemeColors = {
  background: palette.navy975,
  surface: palette.navy900,
  surfaceRaised: palette.navy800,
  border: palette.navy700,
  textPrimary: palette.navy50,
  textSecondary: palette.navy300,
  textMuted: palette.navy500,
  accent: palette.azure400,
  onAccent: palette.azure950,
  accentMuted: '#10254A',
  success: palette.green400,
  warning: palette.amber400,
  danger: palette.red400,
  info: palette.azure300,
  tabBar: palette.navy950,
  tabInactive: palette.navy500,
};

const lightColors: ThemeColors = {
  background: palette.navy50,
  surface: palette.white,
  surfaceRaised: palette.navy100,
  border: palette.navy100,
  textPrimary: palette.navy900,
  textSecondary: '#3E4B66',
  textMuted: '#56647F',
  accent: palette.azure700,
  onAccent: palette.white,
  accentMuted: palette.azure50,
  success: palette.green700,
  warning: palette.amber700,
  danger: palette.red700,
  info: palette.blue700,
  tabBar: palette.white,
  tabInactive: '#56647F',
};

const darkChart: ChartColors = {
  series: ['#4C93FF', '#2DD4BF', '#FBBF24', '#F472B6', '#A78BFA', '#A3E635', '#FB923C', '#38BDF8'],
  grid: palette.navy700,
};

const lightChart: ChartColors = {
  series: ['#0C55C7', '#0F766E', '#B45309', '#BE185D', '#6D28D9', '#4D7C0F', '#C2410C', '#0369A1'],
  grid: palette.navy100,
};

const shared = { spacing, radius, typography };

export const darkTheme: Theme = {
  scheme: 'dark',
  colors: darkColors,
  chart: darkChart,
  ...shared,
};
export const lightTheme: Theme = {
  scheme: 'light',
  colors: lightColors,
  chart: lightChart,
  ...shared,
};

export const themes: Record<ColorScheme, Theme> = {
  dark: darkTheme,
  light: lightTheme,
};
