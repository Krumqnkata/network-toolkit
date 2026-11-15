import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../app/theme';
import { AppText } from './AppText';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  showDivider?: boolean;
  testID?: string;
}

export function ListRow({
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  disabled = false,
  showDivider = false,
  testID,
}: ListRowProps) {
  const theme = useTheme();
  const interactive = Boolean(onPress) && !disabled;

  return (
    <Pressable
      testID={testID}
      onPress={interactive ? onPress : undefined}
      disabled={!interactive}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={onPress ? { disabled: !interactive } : undefined}
      android_ripple={interactive ? { color: theme.colors.surfaceRaised } : undefined}
      style={[
        styles.row,
        {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.md,
        },
        showDivider && {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.body}>
        <AppText variant="heading" color={disabled ? 'textSecondary' : 'textPrimary'}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textMuted">
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 2,
  },
  leading: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 56,
  },
});
