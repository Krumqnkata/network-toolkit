import { contrastRatio, parseHexColor, relativeLuminance } from '../color';

describe('parseHexColor', () => {
  it('parses six-digit and three-digit colors', () => {
    expect(parseHexColor('#14B8A6')).toEqual([20, 184, 166]);
    expect(parseHexColor('#fff')).toEqual([255, 255, 255]);
  });

  it('rejects malformed input', () => {
    expect(() => parseHexColor('14B8A6')).toThrow('Invalid hex color');
    expect(() => parseHexColor('#12345')).toThrow('Invalid hex color');
    expect(() => parseHexColor('#GGGGGG')).toThrow('Invalid hex color');
  });
});

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1);
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#0F766E', '#F3F6F9')).toBeCloseTo(contrastRatio('#F3F6F9', '#0F766E'));
  });
});
