import React, { useState } from 'react';
import { View } from 'react-native';

import { useTheme } from '../../app/theme';
import { AppText, Button } from '../common';
import { useStrings } from '../../i18n';
import {
  openAppSettings,
  openLocationSettings,
  requestPreciseLocation,
} from '../../services/permissions/locationPermission';
import { usePermissionStore } from '../../stores/permissionStore';

export interface LocationNoticeProps {
  /** What the permission unlocks — only changes the explanation. */
  purpose: 'ssid' | 'scan';
  reason: 'permission' | 'location-off';
  /** Called after the permission was granted, to reload network data. */
  onGranted: () => void;
}

/** In-context explanation shown before the system permission dialog. */
export function LocationNotice({ purpose, reason, onGranted }: LocationNoticeProps) {
  const theme = useTheme();
  const s = useStrings();
  const permission = usePermissionStore(state => state.location);
  const [busy, setBusy] = useState(false);

  const blocked = reason === 'permission' && permission === 'blocked';
  const title =
    reason === 'location-off'
      ? s.permissions.locationOffTitle
      : purpose === 'scan'
      ? s.permissions.scanTitle
      : s.permissions.ssidTitle;
  const body =
    reason === 'location-off'
      ? s.permissions.locationOffBody
      : blocked
      ? s.permissions.blockedBody
      : purpose === 'scan'
      ? s.permissions.scanBody
      : s.permissions.ssidBody;
  const actionLabel =
    reason === 'location-off'
      ? s.permissions.openLocationSettings
      : blocked
      ? s.permissions.openSettings
      : s.permissions.allow;

  const onPress = async () => {
    if (reason === 'location-off') {
      await openLocationSettings();
      return;
    }
    if (blocked) {
      await openAppSettings();
      return;
    }
    setBusy(true);
    const result = await requestPreciseLocation();
    setBusy(false);
    if (result === 'granted') onGranted();
  };

  return (
    <View
      testID="location-notice"
      style={{
        backgroundColor: theme.colors.accentMuted,
        borderRadius: theme.radius.md,
        padding: theme.spacing.md,
        gap: theme.spacing.sm,
      }}
    >
      <AppText variant="heading">{title}</AppText>
      <AppText variant="caption" color="textSecondary">
        {body}
      </AppText>
      <Button label={actionLabel} onPress={onPress} busy={busy} />
    </View>
  );
}
