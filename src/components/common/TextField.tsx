import React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../../app/theme';
import { AppText } from './AppText';

export interface TextFieldProps
  extends Pick<
    TextInputProps,
    'value' | 'onChangeText' | 'placeholder' | 'keyboardType' | 'onSubmitEditing' | 'editable'
  > {
  label: string;
  error?: string | null;
  testID?: string;
}

/** Single-line input for technical values: no autocorrect, no capitalization. */
export function TextField({ label, error, testID, ...input }: TextFieldProps) {
  const theme = useTheme();
  return (
    <View style={{ gap: theme.spacing.xs }}>
      <AppText variant="caption" color="textSecondary">
        {label}
      </AppText>
      <TextInput
        {...input}
        testID={testID}
        accessibilityLabel={label}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        returnKeyType="go"
        placeholderTextColor={theme.colors.textMuted}
        style={[
          theme.typography.mono,
          styles.input,
          {
            color: theme.colors.textPrimary,
            backgroundColor: theme.colors.surfaceRaised,
            borderColor: error ? theme.colors.danger : theme.colors.border,
            borderRadius: theme.radius.sm,
            paddingHorizontal: theme.spacing.md,
          },
        ]}
      />
      {error ? (
        <AppText variant="caption" color="danger" accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    minHeight: 44,
  },
});
