import React from 'react';
import { Text, type TextProps, type TextStyle } from 'react-native';

import { useTheme, type ThemeColors, type TypographyVariant } from '../../app/theme';

/**
 * Text follows the system font size up to this factor. Beyond it, fixed-size
 * elements (tab bar, badges, diagrams) would cut text off.
 */
export const MAX_FONT_SCALE = 1.3;

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: keyof ThemeColors;
  align?: TextStyle['textAlign'];
}

/** Themed text. Every piece of visible text in the app goes through this. */
export function AppText({
  variant = 'body',
  color = 'textPrimary',
  align,
  style,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      {...rest}
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
