import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';

import { useTheme } from '../../app/theme';

export interface CardProps extends ViewProps {
  padded?: boolean;
}

export function Card({ padded = true, style, ...rest }: CardProps) {
  const theme = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.base,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.lg,
          padding: padded ? theme.spacing.lg : 0,
        },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
});
