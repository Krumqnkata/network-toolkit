import React, { useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { StyleSheet, Switch, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { ChannelGraph } from '../../../components/charts/ChannelGraph';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Screen,
  SectionHeader,
  SegmentedControl,
} from '../../../components/common';
import { ListRow } from '../../../components/common';
import { SettingsButton } from '../../../components/common/SettingsButton';
import { Icon } from '../../../components/icons/Icon';
import { LocationNotice } from '../../../components/permissions/LocationNotice';
import { networksInBand } from '../../../domain/algorithms/wifiAnalysis';
import type { ScannedNetwork } from '../../../domain/models/wifiScan';
import { formatTime, useLanguage, useStrings } from '../../../i18n';
import { useWifiScanStore } from '../../../stores/wifiScanStore';
import { ChannelRecommendations } from '../components/ChannelRecommendations';
import { NetworkRow } from '../components/NetworkRow';
import { useWifiScanner } from '../hooks/useWifiScanner';

type Band = '2.4' | '5' | '6';
const BANDS: readonly Band[] = ['2.4', '5', '6'];

function networkKey(network: ScannedNetwork): string {
  return network.bssid ?? `${network.ssid ?? 'hidden'}-${network.frequencyMhz}`;
}

export function WifiAnalyzerScreen() {
  const navigation = useNavigation();
  const theme = useTheme();
  const s = useStrings();
  const a = s.wifiAnalyzer;
  const language = useLanguage();
  const { scanning, needsPermission, error, scanNow, onPermissionGranted } = useWifiScanner();
  const result = useWifiScanStore(state => state.result);
  const history = useWifiScanStore(state => state.history);
  const connectedBssid = useWifiScanStore(state => state.connectedBssid);
  const autoScan = useWifiScanStore(state => state.autoScan);
  const setAutoScan = useWifiScanStore(state => state.setAutoScan);
  const [band, setBand] = useState<Band>('2.4');

  const networks = useMemo(() => result?.networks ?? [], [result]);
  const byBand = useMemo(
    () =>
      Object.fromEntries(BANDS.map(b => [b, networksInBand(networks, b)])) as Record<
        Band,
        ScannedNetwork[]
      >,
    [networks],
  );
  const visible = byBand[band];

  // Stable color per network across the graph and the list.
  const colors = useMemo(() => {
    const map = new Map<string, string>();
    visible.forEach((network, index) => {
      map.set(
        networkKey(network),
        theme.chart.series[index % theme.chart.series.length] ?? theme.colors.accent,
      );
    });
    return map;
  }, [visible, theme]);
  const colorFor = (network: ScannedNetwork) =>
    colors.get(networkKey(network)) ?? theme.colors.accent;

  const connected =
    connectedBssid !== null
      ? visible.find(network => network.bssid === connectedBssid) ?? null
      : null;
  const blockedByLocation = result !== null && !result.locationEnabled;
  const wifiOff = result !== null && result.locationEnabled && !result.wifiEnabled;

  return (
    <Screen title={a.title} subtitle={a.subtitle} headerAction={<SettingsButton />}>
      <Card padded={false}>
        <ListRow
          testID="open-wifi-survey"
          title={s.tools.items['wifi-survey'].name}
          subtitle={s.tools.items['wifi-survey'].description}
          onPress={() => navigation.navigate('Tool', { toolId: 'wifi-survey' })}
          leading={<Icon name="wifi" color={theme.colors.accent} />}
          trailing={<Icon name="chevronRight" color={theme.colors.textMuted} size={20} />}
        />
      </Card>
      {needsPermission ? (
        <LocationNotice purpose="scan" reason="permission" onGranted={onPermissionGranted} />
      ) : null}

      {!needsPermission && blockedByLocation ? (
        <LocationNotice purpose="scan" reason="location-off" onGranted={onPermissionGranted} />
      ) : null}

      {wifiOff ? (
        <Card>
          <EmptyState
            icon={<Icon name="wifi" color={theme.colors.textMuted} size={28} />}
            title={a.wifiOffTitle}
            description={a.wifiOffBody}
          />
        </Card>
      ) : null}

      {!needsPermission ? (
        <Card style={{ gap: theme.spacing.md }}>
          <View style={[styles.controls, { gap: theme.spacing.md }]}>
            <Button
              label={scanning ? a.scanning : a.scan}
              onPress={scanNow}
              busy={scanning}
              testID="scan-button"
            />
            <View style={styles.statusText}>
              {result ? (
                <AppText variant="caption" color="textSecondary" testID="scan-summary">
                  {a.summary(networks.length, formatTime(result.timestamp, language))}
                </AppText>
              ) : null}
            </View>
          </View>
          <View style={styles.switchRow}>
            <View style={styles.statusText}>
              <AppText variant="body">{a.autoScan}</AppText>
              <AppText variant="caption" color="textMuted">
                {a.autoScanHint}
              </AppText>
            </View>
            <Switch
              accessibilityLabel={a.autoScan}
              value={autoScan}
              onValueChange={setAutoScan}
              trackColor={{ true: theme.colors.accent, false: theme.colors.surfaceRaised }}
              thumbColor={theme.colors.surface}
            />
          </View>
          {result && !result.scanStarted && result.locationEnabled && result.wifiEnabled ? (
            <AppText variant="caption" color="warning" testID="scan-throttled">
              {a.throttled}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      {error ? (
        <Card>
          <EmptyState
            icon={<Icon name="info" color={theme.colors.danger} size={28} />}
            title={a.errorTitle}
            description={error.message}
            action={<Button label={s.common.retry} onPress={scanNow} />}
          />
        </Card>
      ) : null}

      {result && !needsPermission ? (
        <>
          <SegmentedControl
            accessibilityLabel={s.dashboard.fields.band}
            testID="band-options"
            options={BANDS.map(b => ({
              value: b,
              label: a.bandWithCount(a.bands[b], byBand[b].length),
            }))}
            value={band}
            onChange={setBand}
          />

          <Card padded={false} style={{ paddingVertical: theme.spacing.sm }}>
            <ChannelGraph
              band={band}
              networks={visible}
              colorFor={colorFor}
              connectedBssid={connectedBssid}
              accessibilityLabel={a.graphLabel(visible.length, a.bands[band])}
            />
          </Card>

          {visible.length > 0 ? (
            <ChannelRecommendations band={band} networks={visible} connected={connected} />
          ) : null}

          <SectionHeader title={a.networksTitle} />
          <Card padded={false}>
            {visible.length === 0 ? (
              <EmptyState title={a.emptyBand} />
            ) : (
              visible.map((network, index) => (
                <NetworkRow
                  key={networkKey(network)}
                  network={network}
                  color={colorFor(network)}
                  connected={network.bssid !== null && network.bssid === connectedBssid}
                  history={network.bssid ? history[network.bssid] ?? [] : []}
                  showDivider={index < visible.length - 1}
                />
              ))
            )}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  statusText: {
    flex: 1,
  },
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});
