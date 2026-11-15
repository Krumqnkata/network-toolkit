import { contrastRatio } from '../../../utils/color';
import { resolveColorScheme } from '../resolveColorScheme';
import { themes, type ThemeColors } from '../themes';

const WCAG_AA_TEXT = 4.5;
const WCAG_AA_NON_TEXT = 3;

describe.each(Object.values(themes))('$scheme theme', theme => {
  const { colors } = theme;

  it.each<[keyof ThemeColors, keyof ThemeColors]>([
    ['textPrimary', 'background'],
    ['textPrimary', 'surface'],
    ['textSecondary', 'surface'],
    ['textMuted', 'surface'],
    ['accent', 'surface'],
    ['accent', 'background'],
    ['onAccent', 'accent'],
    ['success', 'surface'],
    ['warning', 'surface'],
    ['danger', 'surface'],
    ['info', 'surface'],
  ])('%s on %s meets WCAG AA for text', (fg, bg) => {
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(WCAG_AA_TEXT);
  });

  it('chart series colors stand out from the surface', () => {
    for (const color of theme.chart.series) {
      expect(contrastRatio(color, colors.surface)).toBeGreaterThanOrEqual(WCAG_AA_NON_TEXT);
    }
    expect(new Set(theme.chart.series).size).toBe(theme.chart.series.length);
  });

  it('inactive tab icons are distinguishable from the tab bar', () => {
    expect(contrastRatio(colors.tabInactive, colors.tabBar)).toBeGreaterThanOrEqual(
      WCAG_AA_NON_TEXT,
    );
  });
});

describe('resolveColorScheme', () => {
  it('uses an explicit preference regardless of the system scheme', () => {
    expect(resolveColorScheme('light', 'dark')).toBe('light');
    expect(resolveColorScheme('dark', 'light')).toBe('dark');
  });

  it('follows the system scheme when the preference is "system"', () => {
    expect(resolveColorScheme('system', 'light')).toBe('light');
    expect(resolveColorScheme('system', 'dark')).toBe('dark');
  });

  it('falls back to dark when the system reports no scheme', () => {
    expect(resolveColorScheme('system', null)).toBe('dark');
    expect(resolveColorScheme('system', undefined)).toBe('dark');
    expect(resolveColorScheme('system', 'unspecified')).toBe('dark');
  });
});
