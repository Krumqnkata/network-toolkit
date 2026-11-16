import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '../../app/theme';
import { useStrings } from '../../i18n';
import { Icon } from '../icons/Icon';

/** Gear button in the top-right corner of every tab; opens Settings. */
export function SettingsButton() {
  const theme = useTheme();
  const s = useStrings();
  const navigation = useNavigation();
  return (
    <Pressable
      testID="open-settings"
      accessibilityRole="button"
      accessibilityLabel={s.home.settings}
      hitSlop={10}
      onPress={() => navigation.navigate('Settings')}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: theme.colors.accentMuted,
          borderColor: theme.colors.border,
          borderRadius: theme.radius.md,
          opacity: pressed ? 0.7 : 1,
          transform: [{ scale: pressed ? 0.95 : 1 }],
        },
      ]}
    >
      <Icon name="settings" color={theme.colors.accent} size={24} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
});
