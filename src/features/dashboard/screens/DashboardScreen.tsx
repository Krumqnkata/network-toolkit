import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { LocationNotice } from '../../../components/permissions/LocationNotice';
import { isIPv4 } from '../../../domain/algorithms/ip';
import { statsOf } from '../../../domain/algorithms/monitor';
import {
  cellularRating,
  connectionSummary,
  speedUse,
  wifiRating,
  type ConnectionSummary,
} from '../../../domain/algorithms/plain';
import { formatMbps } from '../../../domain/algorithms/speed';
import type { NetworkSnapshot, WifiLink } from '../../../domain/models/network';
import { formatDateTime, formatTime, useLanguage, useStrings } from '../../../i18n';
import { useHomeStore, type LatencyTarget } from '../../../stores/homeStore';
import { isLanScanning, useLanStore } from '../../../stores/lanStore';
import { useMonitorStore } from '../../../stores/monitorStore';
import { useSpeedTestStore } from '../../../stores/speedTestStore';
import { logError } from '../../../utils/errors';
import { healthReports, type HealthReport } from '../../health-check/services/healthCheck';
import { formatMs } from '../../network-tools/components/ToolFrame';
import { UpdatePanel } from '../../updates/components/UpdatePanel';
import { ConnectionDiagram } from '../components/ConnectionDiagram';
import { FactorsCard, RATING_COLOR, type Factor } from '../components/FactorsCard';
import { HomeTile } from '../components/HomeTile';
import { IpConfigCard } from '../components/IpConfigCard';
import { LatencyRow } from '../components/LatencyRow';
import { WifiCard } from '../components/WifiCard';
import { formatBand, ssidBlocker } from '../format';
import { useNetworkSnapshot } from '../hooks/useNetworkSnapshot';
import {
  loadHomeSettings,
  refreshLatency,
  refreshPublicInfo,
  SITE_TARGETS,
} from '../services/homeData';

const SUMMARY_COLOR: Record<ConnectionSummary, keyof ThemeColors> = {
  good: 'success',
  slow: 'warning',
  'weak-signal': 'warning',
  checking: 'textSecondary',
  portal: 'warning',
  'no-internet': 'danger',
  offline: 'danger',
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
  const latency = useHomeStore(state => state.latency);
  const latencyLoading = useHomeStore(state => state.latencyLoading);
  const publicInfo = useHomeStore(state => state.publicInfo);
  const showPublicInfo = useHomeStore(state => state.showPublicInfo);
  const technicalOpen = useHomeStore(state => state.technicalOpen);
  const setHome = useHomeStore(state => state.set);
  const [health, setHealth] = useState<HealthReport | null>(null);

  const gateway = snapshot?.gateways.find(isIPv4) ?? null;
  const targets = useMemo<LatencyTarget[]>(
    // Mobile data has no router to measure, so the router entry is shown only with a gateway.
    () =>
      gateway
        ? [...SITE_TARGETS, { id: 'gateway', host: gateway, label: t.gatewayLabel }]
        : [...SITE_TARGETS],
    [gateway, t.gatewayLabel],
  );
  const connectionKey = snapshot ? `${snapshot.transport}|${snapshot.wifi?.bssid ?? ''}` : null;
  const lastConnection = useRef<string | null>(null);

  useEffect(() => {
    loadHomeSettings();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSpeed();
      healthReports
        .list(1)
        .then(([latest]) => setHealth((latest?.data as HealthReport | undefined) ?? null))
        .catch(caught => logError('home', caught));
    }, [loadSpeed]),
  );

  // Latency and public info are refreshed on focus and whenever the network changes.
  useFocusEffect(
    useCallback(() => {
      if (!connectionKey || connectionKey.startsWith('none')) return;
      const changed = lastConnection.current !== connectionKey;
      lastConnection.current = connectionKey;
      refreshLatency(targets);
      refreshPublicInfo(changed);
    }, [connectionKey, targets]),
  );

  const onRefresh = () => {
    refresh();
    refreshLatency(targets);
    refreshPublicInfo(true);
  };

  const transport = snapshot?.transport ?? 'none';
  const wifi = snapshot && hasWifi(snapshot) ? snapshot.wifi : null;
  const signalRating =
    transport === 'cellular'
      ? cellularRating(snapshot?.cellularDbm ?? null, snapshot?.cellularLevel ?? null)
      : wifiRating(wifi?.rssi ?? null);
  const summary = snapshot
    ? connectionSummary({
        transport,
        hasInternet: snapshot.hasInternet,
        isValidated: snapshot.isValidated,
        isCaptivePortal: snapshot.isCaptivePortal,
        signal: signalRating,
        latencies: SITE_TARGETS.map(target => latency[target.id] ?? null),
      })
    : null;

  const titleByTransport: Record<string, string> = {
    wifi: t.connection.wifi,
    cellular: t.connection.cellular,
    ethernet: t.connection.ethernet,
    none: t.connection.none,
  };
  const title = snapshot ? titleByTransport[transport] ?? t.connection.other : s.dashboard.title;

  const localIp =
    snapshot?.addresses.find(address => address.family === 'ipv4')?.address ??
    snapshot?.addresses[0]?.address ??
    null;
  const online = !!snapshot?.isValidated && !snapshot.isCaptivePortal;
  const providerName =
    transport === 'cellular' && snapshot?.cellularOperator
      ? snapshot.cellularOperator
      : publicInfo?.provider ?? (showPublicInfo && !publicInfo ? t.loadingProvider : t.provider);
  const statusNode = snapshot?.isCaptivePortal
    ? { text: t.portal, color: 'warning' as const }
    : online
    ? { text: t.available, color: 'success' as const }
    : snapshot?.hasInternet
    ? { text: s.dashboard.internet.checking, color: 'textSecondary' as const }
    : { text: t.unavailable, color: 'danger' as const };

  const factors: Factor[] = [];
  if (transport === 'cellular' && snapshot) {
    if (snapshot.cellularOperator) {
      factors.push({ label: t.operatorLabel, value: snapshot.cellularOperator });
    }
    if (snapshot.cellularGeneration) {
      factors.push({ label: t.standard, value: snapshot.cellularGeneration });
    }
    if (snapshot.cellularDbm !== null) {
      factors.push({
        label: t.signalStrength,
        value: `${snapshot.cellularDbm} dBm`,
        color: signalRating ? RATING_COLOR[signalRating] : undefined,
      });
    } else if (signalRating) {
      factors.push({
        label: t.signalStrength,
        value: t.rating[signalRating],
        color: RATING_COLOR[signalRating],
      });
    }
  } else if (wifi) {
    factors.push({
      label: t.networkLabel,
      value: wifi.ssid ?? (wifi.hiddenSsid ? s.dashboard.fields.hiddenNetwork : '—'),
    });
    const band = formatBand(wifi.frequencyMhz);
    if (band) factors.push({ label: t.bandLabel, value: band });
    if (wifi.rssi !== null) {
      factors.push({
        label: t.signalStrength,
        value: `${wifi.rssi} dBm`,
        color: signalRating ? RATING_COLOR[signalRating] : undefined,
      });
    }
  }

  const problems = health?.findings.filter(finding => finding.severity === 'problem').length ?? 0;
  const warnings = health?.findings.filter(finding => finding.severity === 'warning').length ?? 0;
  const monitorStats = statsOf(monitorAccumulator);
  const use = speedUse(speed?.downloadMbps ?? null);
  const blocker = snapshot && hasWifi(snapshot) ? ssidBlocker(snapshot) : null;

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
      title={title}
      onRefresh={onRefresh}
      refreshing={refreshing}
      headerAction={settingsButton}
    >
      <UpdatePanel compact />

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

      {snapshot && transport !== 'none' ? (
        <ConnectionDiagram
          accessibilityLabel={`${providerName} ${publicInfo?.ip ?? ''} — ${statusNode.text} — ${
            snapshot.deviceName ?? t.thisPhone
          } ${localIp ?? ''}`}
          lineColor={statusNode.color}
          left={{
            icon: transport === 'cellular' ? 'antenna' : 'globe',
            title: providerName,
            subtitle: publicInfo?.ip ?? null,
            status: statusNode,
          }}
          right={{
            icon: 'phone',
            title: snapshot.deviceName ?? t.thisPhone,
            subtitle: localIp,
          }}
        />
      ) : null}

      {snapshot && summary ? (
        <View
          testID="connection-card"
          style={[
            styles.summary,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors[SUMMARY_COLOR[summary]],
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              gap: theme.spacing.sm,
            },
          ]}
        >
          <View style={[styles.dot, { backgroundColor: theme.colors[SUMMARY_COLOR[summary]] }]} />
          <AppText testID="internet-status" variant="body" style={styles.flex}>
            {t.summary[summary]}
          </AppText>
          {snapshot.isVpn ? <Badge label={s.dashboard.badges.vpn} tone="accent" /> : null}
          {snapshot.isMetered ? <Badge label={s.dashboard.badges.metered} /> : null}
        </View>
      ) : null}

      <View style={[styles.row, { marginTop: theme.spacing.sm }]}>
        <AppText variant="title" style={styles.flex}>
          {t.speed}
        </AppText>
        <AppText
          variant="body"
          color="accent"
          accessibilityRole="button"
          onPress={() => navigation.navigate('Main', { screen: 'SpeedTest' })}
        >
          {t.allResults}
        </AppText>
      </View>
      <Button
        testID="home-run-speed"
        block
        label={t.startSpeedTest}
        onPress={() =>
          navigation.navigate('Main', { screen: 'SpeedTest', params: { autoStart: Date.now() } })
        }
      />
      {speed ? (
        <Card testID="home-speed" style={{ gap: theme.spacing.sm }}>
          <View style={[styles.row, { gap: theme.spacing.lg }]}>
            <View style={styles.flex}>
              <View style={[styles.row, { gap: theme.spacing.xs }]}>
                <Icon name="arrowDown" color={theme.colors.accent} size={16} />
                <AppText variant="caption" color="textSecondary">
                  {t.download}
                </AppText>
              </View>
              <AppText variant="display" testID="home-download">
                {formatMbps(speed.downloadMbps)}
              </AppText>
            </View>
            <View style={styles.flex}>
              <View style={[styles.row, { gap: theme.spacing.xs }]}>
                <Icon name="arrowUp" color={theme.colors.info} size={16} />
                <AppText variant="caption" color="textSecondary">
                  {t.upload}
                </AppText>
              </View>
              <AppText variant="display" testID="home-upload">
                {formatMbps(speed.uploadMbps)}
              </AppText>
            </View>
            <View style={styles.flex}>
              <AppText variant="caption" color="textSecondary">
                {t.ping}
              </AppText>
              <AppText variant="display">
                {speed.idleLatencyMs === null ? '—' : Math.round(speed.idleLatencyMs)}
              </AppText>
            </View>
          </View>
          <AppText variant="caption" color="textMuted">
            {`${t.mbps} · ${t.lastTest(formatDateTime(speed.finishedAt, language))}`}
          </AppText>
          {use ? (
            <AppText testID="home-speed-use" variant="body" color="success">
              {t.speedUse[use]}
            </AppText>
          ) : null}
        </Card>
      ) : (
        <AppText variant="caption" color="textSecondary">
          {t.noSpeed}
        </AppText>
      )}

      {blocker ? <LocationNotice purpose="ssid" reason={blocker} onGranted={refresh} /> : null}

      {factors.length > 0 ? (
        <>
          <SectionHeader title={t.factors} />
          <FactorsCard
            title={transport === 'cellular' ? t.factorsCellular : t.factorsWifi}
            factors={factors}
            rating={signalRating}
          />
        </>
      ) : null}

      {snapshot && transport !== 'none' ? (
        <>
          <AppText variant="title" style={{ marginTop: theme.spacing.sm }}>
            {t.latencyTitle}
          </AppText>
          <AppText variant="caption" color="textMuted">
            {t.latencyHint}
          </AppText>
          <LatencyRow
            targets={targets}
            latency={latency}
            loading={latencyLoading}
            onOpen={host => navigation.navigate('Tool', { toolId: 'ping', host })}
          />
        </>
      ) : null}

      <SectionHeader title={t.moreTools} />
      <View style={[styles.grid, { gap: theme.spacing.md }]}>
        <HomeTile
          testID="home-devices"
          icon="lan"
          title={t.devices}
          value={
            isLanScanning(lanPhase)
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
          value={publicInfo?.ip ?? t.publicIpValue}
          accessibilityLabel={t.open(t.publicIp)}
          onPress={() => navigation.navigate('Tool', { toolId: 'ip-info' })}
        />
      </View>

      {snapshot && transport !== 'none' ? (
        <Pressable
          testID="toggle-technical"
          accessibilityRole="button"
          accessibilityState={{ expanded: technicalOpen }}
          onPress={() => setHome({ technicalOpen: !technicalOpen })}
          style={[styles.row, { gap: theme.spacing.sm, paddingVertical: theme.spacing.sm }]}
        >
          <View style={styles.flex}>
            <AppText variant="heading">{technicalOpen ? t.showLess : t.technical}</AppText>
            {technicalOpen ? null : (
              <AppText variant="caption" color="textMuted">
                {t.technicalHint}
              </AppText>
            )}
          </View>
          <Icon
            name={technicalOpen ? 'arrowUp' : 'arrowDown'}
            color={theme.colors.textSecondary}
            size={20}
          />
        </Pressable>
      ) : null}

      {snapshot && technicalOpen ? (
        <>
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
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  flex: {
    flex: 1,
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
  summary: {
    alignItems: 'center',
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
