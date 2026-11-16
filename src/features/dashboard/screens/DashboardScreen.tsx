import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '../../../app/theme';
import {
  AppText,
  Badge,
  Button,
  Card,
  EmptyState,
  InfoRow,
  Screen,
  SectionHeader,
} from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import { statsOf } from '../../../domain/algorithms/monitor';
import type { NetworkSnapshot, WifiLink } from '../../../domain/models/network';
import { formatTime, useLanguage, useStrings } from '../../../i18n';
import { useLanStore } from '../../../stores/lanStore';
import { useMonitorStore } from '../../../stores/monitorStore';
import { useSpeedTestStore } from '../../../stores/speedTestStore';
import { logError } from '../../../utils/errors';
import { healthReports, type HealthReport } from '../../health-check/services/healthCheck';
import { formatMs } from '../../network-tools/components/ToolFrame';
import { UpdatePanel } from '../../updates/components/UpdatePanel';
import { HomeTile } from '../components/HomeTile';
import { IpConfigCard } from '../components/IpConfigCard';
import { SignalCard } from '../components/SignalCard';
import { SpeedHeroCard } from '../components/SpeedHeroCard';
import { WifiCard } from '../components/WifiCard';
import { internetStatus, type InternetStatus } from '../format';
import { useNetworkSnapshot } from '../hooks/useNetworkSnapshot';

/** RSSI readings kept for the signal trend (about two minutes at 3 s polling). */
const RSSI_HISTORY = 40;

const STATUS_COLOR: Record<InternetStatus, keyof ThemeColors> = {
  ok: 'success',
  'captive-portal': 'warning',
  checking: 'textMuted',
  none: 'danger',
};

function hasWifi(snapshot: NetworkSnapshot): snapshot is NetworkSnapshot & { wifi: WifiLink } {
  return snapshot.wifi !== null;
}

export function DashboardScreen() {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const t = s.home;
  const navigation = useNavigation();
  const { snapshot, error, loading, refreshing, refresh } = useNetworkSnapshot();

  const speed = useSpeedTestStore(state => state.results[0]?.data ?? null);
  const loadSpeed = useSpeedTestStore(state => state.load);
  const lanDevices = useLanStore(state => state.devices.length);
  const lanPhase = useLanStore(state => state.phase);
  const monitorRunning = useMonitorStore(state => state.running);
  const monitorAccumulator = useMonitorStore(state => state.accumulator);
  const [health, setHealth] = useState<HealthReport | null>(null);
  const [rssiHistory, setRssiHistory] = useState<number[]>([]);
  const lastTimestamp = useRef<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadSpeed();
      healthReports
        .list(1)
        .then(([latest]) => setHealth((latest?.data as HealthReport | undefined) ?? null))
        .catch(caught => logError('home', caught));
    }, [loadSpeed]),
  );

  // Collect one RSSI sample per new snapshot for the trend line.
  useEffect(() => {
    if (!snapshot || snapshot.timestamp === lastTimestamp.current) return;
    lastTimestamp.current = snapshot.timestamp;
    const rssi = snapshot.wifi?.rssi;
    if (rssi === null || rssi === undefined) return;
    setRssiHistory(previous => [...previous, rssi].slice(-RSSI_HISTORY));
  }, [snapshot]);

  const status = snapshot ? internetStatus(snapshot) : null;
  const statusText: Record<InternetStatus, string> = {
    ok: s.dashboard.internet.ok,
    'captive-portal': s.dashboard.internet.captivePortal,
    checking: s.dashboard.internet.checking,
    none: s.dashboard.internet.none,
  };

  const networkName = !snapshot
    ? s.dashboard.title
    : snapshot.transport === 'none'
    ? t.offline
    : snapshot.transport === 'wifi'
    ? snapshot.wifi?.ssid ?? t.wifiUnnamed
    : s.transport[snapshot.transport];

  const problems = health?.findings.filter(finding => finding.severity === 'problem').length ?? 0;
  const warnings = health?.findings.filter(finding => finding.severity === 'warning').length ?? 0;
  const monitorStats = statsOf(monitorAccumulator);

  const settingsButton = (
    <Pressable
      testID="open-settings"
      accessibilityRole="button"
      accessibilityLabel={t.settings}
      hitSlop={12}
      onPress={() => navigation.navigate('Settings')}
      style={[
        styles.iconButton,
        { backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radius.pill },
      ]}
    >
      <Icon name="settings" color={theme.colors.textSecondary} size={22} />
    </Pressable>
  );

  return (
    <Screen
      overline={t.overline}
      title={networkName}
      onRefresh={refresh}
      refreshing={refreshing}
      headerAction={settingsButton}
    >
      {snapshot ? (
        <View testID="connection-card" style={[styles.status, { gap: theme.spacing.sm }]}>
          {status ? (
            <View style={[styles.row, { gap: theme.spacing.xs }]}>
              <View style={[styles.dot, { backgroundColor: theme.colors[STATUS_COLOR[status]] }]} />
              <AppText variant="body" color={STATUS_COLOR[status]} testID="internet-status">
                {statusText[status]}
              </AppText>
            </View>
          ) : (
            <AppText variant="caption" color="textSecondary">
              {s.dashboard.notConnectedHint}
            </AppText>
          )}
          {snapshot.transport !== 'none' ? (
            <AppText variant="caption" color="textMuted">
              {s.dashboard.connectedVia(s.transport[snapshot.transport])}
            </AppText>
          ) : null}
          {snapshot.isVpn ? <Badge label={s.dashboard.badges.vpn} tone="accent" /> : null}
          {snapshot.isMetered ? <Badge label={s.dashboard.badges.metered} /> : null}
        </View>
      ) : null}

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

      <UpdatePanel compact />

      <SpeedHeroCard
        result={speed}
        onRun={() => navigation.navigate('Main', { screen: 'SpeedTest' })}
      />

      {snapshot && hasWifi(snapshot) && snapshot.wifi.rssi !== null ? (
        <SignalCard
          wifi={snapshot.wifi}
          history={rssiHistory}
          onPress={() => navigation.navigate('Main', { screen: 'WifiAnalyzer' })}
        />
      ) : null}

      <View style={[styles.grid, { gap: theme.spacing.md }]}>
        <HomeTile
          testID="home-devices"
          icon="lan"
          title={t.devices}
          value={
            lanPhase === 'probing' || lanPhase === 'naming'
              ? t.devicesScanning
              : lanDevices > 0
              ? t.devicesValue(lanDevices)
              : t.devicesEmpty
          }
          accessibilityLabel={t.open(t.devices)}
          onPress={() => navigation.navigate('Main', { screen: 'Devices' })}
        />
        <HomeTile
          testID="home-health"
          icon="pulse"
          title={t.health}
          value={
            health
              ? problems + warnings === 0
                ? t.healthOk
                : t.healthIssues(problems, warnings)
              : t.healthEmpty
          }
          valueColor={
            !health
              ? 'textSecondary'
              : problems > 0
              ? 'danger'
              : warnings > 0
              ? 'warning'
              : 'success'
          }
          accessibilityLabel={t.open(t.health)}
          onPress={() => navigation.navigate('Tool', { toolId: 'health-check' })}
        />
        <HomeTile
          testID="home-monitor"
          icon="route"
          title={t.monitor}
          value={monitorRunning ? t.monitorLive(formatMs(monitorStats.avgMs, s)) : t.monitorIdle}
          valueColor={monitorRunning ? 'accent' : 'textSecondary'}
          accessibilityLabel={t.open(t.monitor)}
          onPress={() => navigation.navigate('Tool', { toolId: 'connection-monitor' })}
        />
        <HomeTile
          testID="home-ip"
          icon="globe"
          title={t.publicIp}
          value={t.publicIpValue}
          accessibilityLabel={t.open(t.publicIp)}
          onPress={() => navigation.navigate('Tool', { toolId: 'ip-info' })}
        />
      </View>

      {snapshot && hasWifi(snapshot) ? (
        <>
          <SectionHeader title={s.dashboard.sections.wifi} />
          <WifiCard snapshot={snapshot} onPermissionGranted={refresh} />
        </>
      ) : null}

      {snapshot?.cellularOperator ? (
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

      {snapshot && snapshot.transport !== 'none' ? (
        <>
          <SectionHeader title={t.details} />
          <IpConfigCard snapshot={snapshot} />
        </>
      ) : null}

      {snapshot ? (
        <AppText variant="caption" color="textMuted" align="center">
          {s.common.updatedAt(formatTime(snapshot.timestamp, language))}
        </AppText>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  iconButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  loading: {
    alignItems: 'center',
    gap: 8,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  status: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: -12,
  },
});
