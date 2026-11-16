import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { AppText, Button, ProgressBar } from '../../../components/common';
import { useStrings } from '../../../i18n';
import { useUpdateStore } from '../../../stores/updateStore';
import {
  checkForUpdates,
  downloadAndInstall,
  installDownloaded,
  requestInstallPermission,
} from '../services/updater';

/**
 * Update status and the action that fits it. `compact` (home banner) shows
 * nothing unless an update needs attention.
 */
export function UpdatePanel({ compact = false }: { compact?: boolean }) {
  const theme = useTheme();
  const s = useStrings();
  const t = s.updates;
  const { phase, update, progress, error, info } = useUpdateStore();

  const attention =
    phase === 'available' ||
    phase === 'downloading' ||
    phase === 'needs-permission' ||
    phase === 'installing' ||
    (phase === 'error' && update !== null);
  if (compact && !attention) return null;

  let message: string | null = null;
  let action: React.ReactNode = null;
  switch (phase) {
    case 'checking':
      message = t.checking;
      break;
    case 'up-to-date':
      message = t.upToDate;
      break;
    case 'unsupported':
      message = t.unsupported;
      break;
    case 'available':
      message = update ? t.available(update.version) : null;
      action = (
        <Button testID="update-install" label={t.install} onPress={() => downloadAndInstall()} />
      );
      break;
    case 'downloading':
      message = t.downloading(Math.round(progress * 100));
      break;
    case 'needs-permission':
      message = t.needsPermission;
      action = (
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <Button testID="update-allow" label={t.allow} onPress={requestInstallPermission} />
          <Button label={t.retry} variant="secondary" onPress={() => installDownloaded()} />
        </View>
      );
      break;
    case 'installing':
      message = info && !info.silentUpdates ? `${t.installing} ${t.confirmHint}` : t.installing;
      break;
    case 'error':
      message = t.failed(error ?? '');
      action = (
        <Button
          testID="update-retry"
          label={t.retry}
          variant="secondary"
          onPress={() => (update ? downloadAndInstall() : checkForUpdates())}
        />
      );
      break;
    default:
      break;
  }

  return (
    <View
      testID={compact ? 'update-banner' : 'update-panel'}
      accessibilityLiveRegion="polite"
      style={[
        compact && {
          backgroundColor: theme.colors.accentMuted,
          borderColor: theme.colors.accent,
          borderRadius: theme.radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          padding: theme.spacing.lg,
        },
        { gap: theme.spacing.sm },
      ]}
    >
      {message ? (
        <AppText
          testID="update-message"
          variant={compact ? 'heading' : 'body'}
          color={phase === 'error' ? 'danger' : 'textPrimary'}
        >
          {message}
        </AppText>
      ) : null}
      {phase === 'downloading' ? <ProgressBar value={progress} label={message ?? ''} /> : null}
      {update && (phase === 'available' || phase === 'downloading') ? (
        <AppText
          variant="caption"
          color="accent"
          accessibilityRole="link"
          onPress={() => Linking.openURL(update.releaseUrl)}
        >
          {t.releaseNotes}
        </AppText>
      ) : null}
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
