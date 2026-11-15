import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '../../../app/theme';
import { AppText, Badge, Card } from '../../../components/common';
import { Icon, type IconName } from '../../../components/icons/Icon';
import type { NetworkSnapshot, TransportType } from '../../../domain/models/network';
import { useStrings } from '../../../i18n';
import { internetStatus, type InternetStatus } from '../format';

const TRANSPORT_ICON: Record<TransportType, IconName> = {
  wifi: 'wifi',
  cellular: 'pulse',
  ethernet: 'lan',
  bluetooth: 'route',
  vpn: 'lock',
  other: 'globe',
  none: 'info',
};

const STATUS_COLOR: Record<InternetStatus, keyof ThemeColors> = {
  ok: 'success',
  'captive-portal': 'warning',
  checking: 'textMuted',
  none: 'danger',
};

export function ConnectionCard({ snapshot }: { snapshot: NetworkSnapshot }) {
  const theme = useTheme();
  const s = useStrings();
  const status = internetStatus(snapshot);
  const connected = snapshot.transport !== 'none';

  const statusText: Record<InternetStatus, string> = {
    ok: s.dashboard.internet.ok,
    'captive-portal': s.dashboard.internet.captivePortal,
    checking: s.dashboard.internet.checking,
    none: s.dashboard.internet.none,
  };

  return (
    <Card testID="connection-card" style={[styles.card, { gap: theme.spacing.lg }]}>
      <View
        style={[
          styles.icon,
          { backgroundColor: theme.colors.accentMuted, borderRadius: theme.radius.pill },
        ]}
      >
        <Icon
          name={TRANSPORT_ICON[snapshot.transport]}
          color={connected ? theme.colors.accent : theme.colors.textMuted}
          size={28}
        />
      </View>
      <View style={[styles.body, { gap: theme.spacing.xs }]}>
        <AppText variant="title" accessibilityRole="header">
          {connected
            ? s.dashboard.connectedVia(s.transport[snapshot.transport])
            : s.dashboard.notConnected}
        </AppText>
        {status ? (
          <AppText variant="body" color={STATUS_COLOR[status]} testID="internet-status">
            {statusText[status]}
          </AppText>
        ) : (
          <AppText variant="caption" color="textSecondary">
            {s.dashboard.notConnectedHint}
          </AppText>
        )}
        {snapshot.isVpn || snapshot.isMetered ? (
          <View style={[styles.badges, { gap: theme.spacing.sm, marginTop: theme.spacing.xs }]}>
            {snapshot.isVpn ? <Badge label={s.dashboard.badges.vpn} tone="accent" /> : null}
            {snapshot.isMetered ? <Badge label={s.dashboard.badges.metered} /> : null}
          </View>
        ) : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
  },
  body: {
    flex: 1,
  },
  card: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  icon: {
    alignItems: 'center',
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
});
