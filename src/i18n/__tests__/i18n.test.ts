import { resolveLanguage, translations } from '..';

type Tree = { [key: string]: unknown };

function leaves(tree: Tree, prefix = ''): [string, unknown][] {
  return Object.entries(tree).flatMap(([key, value]) =>
    value !== null && typeof value === 'object'
      ? leaves(value as Tree, `${prefix}${key}.`)
      : [[`${prefix}${key}`, value] as [string, unknown]],
  );
}

describe('resolveLanguage', () => {
  it('uses an explicit preference', () => {
    expect(resolveLanguage('bg', 'en-US')).toBe('bg');
    expect(resolveLanguage('en', 'bg-BG')).toBe('en');
  });

  it('follows a supported device language', () => {
    expect(resolveLanguage('system', 'bg-BG')).toBe('bg');
    expect(resolveLanguage('system', 'BG')).toBe('bg');
  });

  it('falls back to English for unsupported device languages', () => {
    expect(resolveLanguage('system', 'de-DE')).toBe('en');
    expect(resolveLanguage('system', '')).toBe('en');
  });
});

describe('translations', () => {
  const english = leaves(translations.en as unknown as Tree);

  it.each(Object.entries(translations))('%s has the same keys as English', (_, strings) => {
    const keys = leaves(strings as unknown as Tree).map(([key]) => key);
    expect(keys.sort()).toEqual(english.map(([key]) => key).sort());
  });

  it.each(Object.entries(translations))('%s has no empty strings', (_, strings) => {
    for (const [key, value] of leaves(strings as unknown as Tree)) {
      if (typeof value === 'string') {
        expect({ key, empty: value.trim() === '' }).toEqual({ key, empty: false });
      }
    }
  });

  it('formats parameterized Bulgarian strings', () => {
    expect(translations.bg.settings.version('1.2.3')).toBe('Версия 1.2.3');
    expect(translations.bg.dashboard.connectedVia(translations.bg.transport.cellular)).toBe(
      'Свързан чрез мобилни данни',
    );
  });
});
