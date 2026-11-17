import { useNavigation, useRoute } from '@react-navigation/native';
import { isLocalNetworkError } from '../../../services/permissions/localNetworkPermission';
import { LocalNetworkNotice } from '../../../components/permissions/LocalNetworkNotice';
import React, { useState } from 'react';
import { SettingsButton } from '../../../components/common/SettingsButton';
import { Pressable, StyleSheet, View } from 'react-native';

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
    case 'permission-denied':
      return errors[error.code];
    default:
      return errors.generic;
  }
}

/** What the user can do about an error. */
export function errorHint(error: AppError, s: Strings): string {
  const hints = s.netTools.errorHints;
  switch (error.code) {
    case 'unknown-host':
    case 'timeout':
    case 'invalid-input':
    case 'unsupported':
    case 'network':
    case 'permission-denied':
      return hints[error.code];
    default:
      return hints.generic;
  }
}

export function ErrorNotice({ error }: { error: AppError }) {
  const theme = useTheme();
  const s = useStrings();
  if (isLocalNetworkError(error)) return <LocalNetworkNotice />;
  // Messages written by the app are for people; native ones (with a cause) are technical.
  const technical = error.cause !== undefined;
  return (
    <Card testID="tool-error" accessibilityLiveRegion="polite">
      <View style={[styles.column, { gap: theme.spacing.xs }]}>
        <AppText variant="heading" color="danger">
          {errorTitle(error, s)}
        </AppText>
        {error.message && !technical ? (
          <AppText variant="body" color="textPrimary">
            {error.message}
          </AppText>
        ) : null}
        <AppText variant="caption" color="textSecondary">
          {errorHint(error, s)}
        </AppText>
        {error.message && technical ? <ErrorDetails message={error.message} /> : null}
      </View>
    </Card>
  );
}

/** The raw error text, for support or a bug report; hidden until asked for. */
function ErrorDetails({ message }: { message: string }) {
  const s = useStrings();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        testID="tool-error-details"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(value => !value)}
        style={styles.details}
      >
        <AppText variant="caption" color="accent">
          {s.netTools.errorDetails}
        </AppText>
      </Pressable>
      {open ? (
        <AppText variant="mono" color="textSecondary" selectable>
          {message}
        </AppText>
      ) : null}
    </>
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
  details: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 48,
  },
  column: {
    flexDirection: 'column',
  },
});
