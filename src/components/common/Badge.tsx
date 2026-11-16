import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '../../app/theme';
import { AppText } from './AppText';

export type BadgeTone = 'accent' | 'neutral' | 'success' | 'warning' | 'danger';

const toneToColor: Record<BadgeTone, keyof ThemeColors> = {
  accent: 'accent',
  neutral: 'textMuted',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
};

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const theme = useTheme();
  const color = toneToColor[tone];
  return (
    <View
      style={[
        styles.badge,
        {
          borderColor: theme.colors[color],
          borderRadius: theme.radius.pill,
          paddingHorizontal: theme.spacing.sm,
        },
      ]}
    >
      <AppText variant="overline" color={color} fit>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    // Never squeezed by a long title next to it.
    flexShrink: 0,
    paddingVertical: 2,
  },
});
