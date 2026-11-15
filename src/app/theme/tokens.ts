/**
 * Raw design tokens. Screens and components must not use these directly —
 * they go through the semantic theme (see `themes.ts`) so that light and dark
 * mode stay consistent.
 */
export const palette = {
  ink950: '#060A0F',
  ink900: '#0B1117',
  ink850: '#101820',
  ink800: '#16212B',
  ink700: '#20303D',
  ink600: '#304555',
  ink500: '#4A6273',
  ink400: '#6C8496',
  ink300: '#94A8B8',
  ink200: '#C2D0DB',
  ink100: '#E3EAF0',
  ink50: '#F3F6F9',
  white: '#FFFFFF',

  signal300: '#5EEAD4',
  signal400: '#2DD4BF',
  signal500: '#14B8A6',
  signal600: '#0D9488',
  signal700: '#0F766E',
  signal950: '#042F2E',
  signal50: '#E6FAF6',

  green400: '#4ADE80',
  green700: '#15803D',
  amber400: '#FBBF24',
  amber700: '#B45309',
  red400: '#F87171',
  red700: '#B91C1C',
  blue400: '#60A5FA',
  blue700: '#1D4ED8',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

/** Monospace is used for technical values (IP/MAC addresses, ports, dBm). */
export const fontFamilies = {
  sans: undefined,
  mono: 'monospace',
} as const;

export const typography = {
  display: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  title: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  heading: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  overline: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '600',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  mono: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
    fontFamily: fontFamilies.mono,
  },
} as const;

export type TypographyVariant = keyof typeof typography;
