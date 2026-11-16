import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../../app/theme';
import { AppText } from './AppText';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  busy?: boolean;
  disabled?: boolean;
  testID?: string;
  /** Full-width, taller button with larger text for the main action of a screen. */
  block?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  busy = false,
  disabled = false,
  testID,
  block = false,
}: ButtonProps) {
  const theme = useTheme();
  const primary = variant === 'primary';
  const inactive = disabled || busy;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        block && styles.block,
        {
          backgroundColor: primary ? theme.colors.accent : 'transparent',
          borderColor: theme.colors.accent,
          borderRadius: block ? theme.radius.md : theme.radius.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: block ? theme.spacing.lg : theme.spacing.sm,
          gap: theme.spacing.sm,
          opacity: inactive ? 0.6 : pressed ? 0.85 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color={primary ? theme.colors.onAccent : theme.colors.accent}
        />
      ) : null}
      <AppText
        variant={block ? 'heading' : 'caption'}
        color={primary ? 'onAccent' : 'accent'}
        style={styles.label}
      >
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    minHeight: 56,
  },
  button: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 40,
  },
  label: {
    fontWeight: '700',
  },
});
