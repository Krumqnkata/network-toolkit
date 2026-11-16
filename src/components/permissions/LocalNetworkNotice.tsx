import React, { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../app/theme';
import { useStrings } from '../../i18n';
import { openAppSettings } from '../../services/permissions/locationPermission';
import { requestLocalNetwork } from '../../services/permissions/localNetworkPermission';
import { usePermissionStore } from '../../stores/permissionStore';
import { AppText, Button } from '../common';

/**
 * Explains why the app needs "Nearby devices → local network" (Android 17+)
 * and offers to allow it, or to open the settings after "Don't allow again".
 */
export function LocalNetworkNotice({ onGranted }: { onGranted?: () => void }) {
  const theme = useTheme();
  const t = useStrings().permissions;
  const state = usePermissionStore(store => store.localNetwork);
  const [busy, setBusy] = useState(false);
  const blocked = state === 'blocked';

  const onPress = async () => {
    if (blocked) {
      await openAppSettings();
      return;
    }
    setBusy(true);
    const result = await requestLocalNetwork();
    setBusy(false);
    if (result === 'granted') onGranted?.();
  };

  return (
    <View
      testID="local-network-notice"
      accessibilityLiveRegion="polite"
      style={{
        backgroundColor: theme.colors.accentMuted,
        borderRadius: theme.radius.md,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      <AppText variant="heading">{t.localNetworkTitle}</AppText>
      <AppText variant="caption" color="textSecondary">
        {blocked ? t.localNetworkBlocked : t.localNetworkBody}
      </AppText>
      <Button
        testID="local-network-allow"
        label={blocked ? t.openSettings : t.allow}
        onPress={onPress}
        busy={busy}
      />
    </View>
  );
}
