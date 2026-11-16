import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { AppText, Card, Screen } from '../../../components/common';
import { useStrings, type Strings } from '../../../i18n';
import type { AppError } from '../../../utils/errors';
import type { ToolId } from '../toolCatalog';

/** Screen frame shared by every tool: title, description and a back button. */
export function ToolFrame({ toolId, children }: { toolId: ToolId; children: React.ReactNode }) {
  const navigation = useNavigation();
  const s = useStrings();
  const text = s.tools.items[toolId];
  return (
    <Screen
      title={text.name}
      subtitle={text.description}
      onBack={() => navigation.goBack()}
      backLabel={s.netTools.back}
    >
      {children}
    </Screen>
  );
}

export function errorTitle(error: AppError, s: Strings): string {
  const errors = s.netTools.errors;
  switch (error.code) {
    case 'unknown-host':
    case 'timeout':
    case 'invalid-input':
    case 'unsupported':
    case 'network':
      return errors[error.code];
    default:
      return errors.generic;
  }
}

export function ErrorNotice({ error }: { error: AppError }) {
  const theme = useTheme();
  const s = useStrings();
  return (
    <Card testID="tool-error" accessibilityLiveRegion="polite">
      <View style={[styles.column, { gap: theme.spacing.xs }]}>
        <AppText variant="heading" color="danger">
          {errorTitle(error, s)}
        </AppText>
        {error.message ? (
          <AppText variant="mono" color="textSecondary" selectable>
            {error.message}
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

/** Groups form fields inside a card with consistent spacing. */
export function FormCard({ children }: { children: React.ReactNode }) {
  const theme = useTheme();
  return (
    <Card>
      <View style={[styles.column, { gap: theme.spacing.md }]}>{children}</View>
    </Card>
  );
}

export function formatMs(value: number | null, s: Strings): string {
  if (value === null) return '—';
  return s.netTools.ms(
    value < 10 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : value.toFixed(0),
  );
}

const styles = StyleSheet.create({
  column: {
    flexDirection: 'column',
  },
});
