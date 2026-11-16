import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../app/theme';

/** Determinate progress, 0–1. */
export function ProgressBar({ value, label }: { value: number; label: string }) {
  const theme = useTheme();
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        styles.track,
        { backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radius.pill },
      ]}
    >
      <View
        style={[
          styles.fill,
          {
            width: `${Math.round(clamped * 100)}%`,
            backgroundColor: theme.colors.accent,
            borderRadius: theme.radius.pill,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    height: '100%',
  },
  track: {
    height: 6,
    overflow: 'hidden',
  },
});
