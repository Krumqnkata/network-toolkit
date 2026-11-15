import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../app/theme';
import { AppText } from './AppText';

export function SectionHeader({ title }: { title: string }) {
  const theme = useTheme();
  return (
    <View style={{ paddingHorizontal: theme.spacing.xs, marginBottom: -theme.spacing.sm }}>
      <AppText variant="overline" color="textMuted" accessibilityRole="header">
        {title}
      </AppText>
    </View>
  );
}
