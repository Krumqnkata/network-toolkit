import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../app/theme';
import { AppText } from './AppText';

export function SectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <View style={{ marginTop: theme.spacing.xs, marginBottom: -theme.spacing.xs }}>
      <AppText variant="heading" color="textSecondary" accessibilityRole="header">
        {title}
      </AppText>
    </View>
  );
}
