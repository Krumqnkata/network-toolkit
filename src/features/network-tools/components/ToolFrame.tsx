import { useNavigation, useRoute } from '@react-navigation/native';
import { isLocalNetworkError } from '../../../services/permissions/localNetworkPermission';
import { LocalNetworkNotice } from '../../../components/permissions/LocalNetworkNotice';
import React from 'react';
import { SettingsButton } from '../../../components/common/SettingsButton';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { AppText, Card, Screen } from '../../../components/common';
import { useStrings, type Strings } from '../../../i18n';
import type { AppError } from '../../../utils/errors';
import type { ToolId } from '../toolCatalog';

/** Screen frame shared by every tool: title, description and a back button. */
export function ToolFrame({ toolId, children }: { toolId: ToolId; children: React.ReactNode }) {
  const navigation = useNavigation();
  const route = useRoute();
  const s = useStrings();
  const text = s.tools.items[toolId];
  // Tool screens pushed over the tabs get a back button; a tool shown as a tab
  // (Speed) is a top-level screen and has none.
  const pushed = route.name !== 'SpeedTest' && navigation.canGoBack();
  return (
    <Screen
      title={text.name}
      subtitle={text.description}
      onBack={pushed ? () => navigation.goBack() : undefined}
      backLabel={s.netTools.back}
      headerAction={pushed ? undefined : <SettingsButton />}
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
  if (isLocalNetworkError(error)) return <LocalNetworkNotice />;
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
