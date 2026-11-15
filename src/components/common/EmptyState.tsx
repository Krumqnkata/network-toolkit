import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../app/theme';
import { AppText } from './AppText';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={[styles.container, { padding: theme.spacing.xl, gap: theme.spacing.sm }]}>
      {icon ? (
        <View
          style={[
            styles.iconWrap,
            {
              backgroundColor: theme.colors.accentMuted,
              borderRadius: theme.radius.pill,
              marginBottom: theme.spacing.sm,
            },
          ]}
        >
          {icon}
        </View>
      ) : null}
      <AppText variant="heading" align="center" accessibilityRole="header">
        {title}
      </AppText>
      {description ? (
        <AppText variant="caption" color="textSecondary" align="center">
          {description}
        </AppText>
      ) : null}
      {action ? <View style={{ marginTop: theme.spacing.md }}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  iconWrap: {
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
});
