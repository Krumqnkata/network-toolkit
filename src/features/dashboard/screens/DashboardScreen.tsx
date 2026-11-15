import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import type { MainTabParamList } from '../../../app/navigation/types';
import { useTheme } from '../../../app/theme';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  InfoRow,
  Screen,
  SectionHeader,
} from '../../../components/common';
import { Icon, type IconName } from '../../../components/icons/Icon';
import type { NetworkSnapshot, WifiLink } from '../../../domain/models/network';
import { formatTime, useLanguage, useStrings } from '../../../i18n';
import { ConnectionCard } from '../components/ConnectionCard';
import { IpConfigCard } from '../components/IpConfigCard';
import { WifiCard } from '../components/WifiCard';
import { useNetworkSnapshot } from '../hooks/useNetworkSnapshot';

interface QuickAction {
  icon: IconName;
  target: 'WifiAnalyzer' | 'Tools';
}

const QUICK_ACTIONS: readonly QuickAction[] = [
  { icon: 'wifi', target: 'WifiAnalyzer' },
  { icon: 'terminal', target: 'Tools' },
];

function hasWifi(snapshot: NetworkSnapshot): snapshot is NetworkSnapshot & { wifi: WifiLink } {
  return snapshot.wifi !== null;
}

export function DashboardScreen() {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const { snapshot, error, loading, refreshing, refresh } = useNetworkSnapshot();

  const quickActionLabel: Record<QuickAction['target'], string> = {
    WifiAnalyzer: s.wifiAnalyzer.title,
    Tools: s.tools.title,
  };

  return (
    <Screen
      title={s.dashboard.title}
      subtitle={s.dashboard.subtitle}
      onRefresh={refresh}
      refreshing={refreshing}
    >
      {loading && !snapshot ? (
        <Card>
          <View style={[styles.loading, { padding: theme.spacing.xl }]}>
            <ActivityIndicator color={theme.colors.accent} />
            <AppText variant="caption" color="textMuted">
              {s.common.loading}
            </AppText>
          </View>
        </Card>
      ) : null}

      {error && !snapshot ? (
        <Card>
          <EmptyState
            icon={<Icon name="info" color={theme.colors.danger} size={28} />}
            title={s.dashboard.errorTitle}
            description={error.message}
            action={<Button label={s.common.retry} onPress={refresh} />}
          />
        </Card>
      ) : null}

      {snapshot ? (
        <>
          <ConnectionCard snapshot={snapshot} />

          {hasWifi(snapshot) ? (
            <>
              <SectionHeader title={s.dashboard.sections.wifi} />
              <WifiCard snapshot={snapshot} onPermissionGranted={refresh} />
            </>
          ) : null}

          {snapshot.cellularOperator ? (
            <>
              <SectionHeader title={s.dashboard.sections.cellular} />
              <Card>
                <InfoRow
                  label={s.dashboard.fields.operator}
                  value={snapshot.cellularOperator}
                  mono={false}
                />
              </Card>
            </>
          ) : null}

          {snapshot.transport !== 'none' ? (
            <>
              <SectionHeader title={s.dashboard.sections.ip} />
              <IpConfigCard snapshot={snapshot} />
            </>
          ) : null}
        </>
      ) : null}

      <SectionHeader title={s.dashboard.quickAccess} />
      <View style={[styles.grid, { gap: theme.spacing.md }]}>
        {QUICK_ACTIONS.map(action => (
          <Pressable
            key={action.target}
            accessibilityRole="button"
            accessibilityLabel={s.dashboard.openAction(quickActionLabel[action.target])}
            onPress={() => navigation.navigate(action.target)}
            style={styles.tile}
          >
            <Card style={{ gap: theme.spacing.md }}>
              <Icon name={action.icon} color={theme.colors.accent} />
              <AppText variant="heading">{quickActionLabel[action.target]}</AppText>
            </Card>
          </Pressable>
        ))}
      </View>

      {snapshot ? (
        <AppText variant="caption" color="textMuted" align="center">
          {s.common.updatedAt(formatTime(snapshot.timestamp, language))}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
  },
  loading: {
    alignItems: 'center',
    gap: 8,
  },
  tile: {
    flex: 1,
  },
});
