import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../app/theme';
import { AppText } from './AppText';
import type { SegmentOption } from './SegmentedControl';

export interface ChoiceChipsProps<T extends string> {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
  testID?: string;
}

/** Wrapping single-choice chips, for option sets too long for a segmented control. */
export function ChoiceChips<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  testID,
}: ChoiceChipsProps<T>) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.wrap, { gap: theme.spacing.sm }]}
    >
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.label}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              {
                borderRadius: theme.radius.pill,
                borderColor: selected ? theme.colors.accent : theme.colors.border,
                backgroundColor: selected ? theme.colors.accent : theme.colors.surfaceRaised,
                paddingHorizontal: theme.spacing.md,
              },
            ]}
          >
            <AppText variant="caption" color={selected ? 'onAccent' : 'textSecondary'}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
