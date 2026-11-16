import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '../../../app/theme';
import { AppText, Card } from '../../../components/common';
import { Icon, type IconName } from '../../../components/icons/Icon';

export interface HomeTileProps {
  icon: IconName;
  title: string;
  value: string;
  valueColor?: keyof ThemeColors;
  onPress: () => void;
  accessibilityLabel: string;
  testID?: string;
}

/** Square shortcut tile for the home grid. */
export function HomeTile({
  icon,
  title,
  value,
  valueColor = 'textSecondary',
  onPress,
  accessibilityLabel,
  testID,
}: HomeTileProps) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={styles.tile}
    >
      <Card style={[styles.card, { gap: theme.spacing.md }]}>
        <View
          style={[
            styles.icon,
            { backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.md },
          ]}
        >
          <Icon name={icon} color={theme.colors.accent} size={20} />
        </View>
        <View style={{ gap: theme.spacing.xxs }}>
          <AppText variant="heading">{title}</AppText>
          <AppText variant="caption" color={valueColor} numberOfLines={2}>
            {value}
          </AppText>
        </View>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 132,
  },
  icon: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
  },
});
