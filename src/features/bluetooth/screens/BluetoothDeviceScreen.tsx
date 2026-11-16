import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useTheme } from '../../../app/theme';
import { Sparkline } from '../../../components/charts/Sparkline';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  InfoRow,
  ProgressBar,
  Screen,
  SectionHeader,
} from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import {
  deviceMaker,
  estimateDistance,
  guessBluetoothKind,
  proximity,
  serviceName,
  signalTrend,
} from '../../../domain/algorithms/bluetooth';
import { useStrings } from '../../../i18n';
import { useBluetoothStore } from '../../../stores/bluetoothStore';
import { BT_KIND_ICON, PROXIMITY_COLOR, rssiFill } from '../components/bluetoothIcon';
import { startScan } from '../services/bluetoothScan';

type Props = NativeStackScreenProps<RootStackParamList, 'BluetoothDevice'>;

/** Seconds without an advert after which the device counts as out of sight. */
const STALE_MS = 10_000;

/** "Find my device": live signal of one device while the scan keeps running. */
export function BluetoothDeviceScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const s = useStrings();
  const t = s.bluetooth;
  const device = useBluetoothStore(state =>
    state.devices.find(candidate => candidate.address === route.params.address),
  );
  const scanning = useBluetoothStore(state => state.scanning);

  const back = () => navigation.goBack();

  if (!device) {
    return (
      <Screen title={t.title} onBack={back} backLabel={s.devices.title}>
        <EmptyState title={t.notFound} />
      </Screen>
    );
  }

  const kind = guessBluetoothKind(device);
  const maker = deviceMaker(device);
  const near = proximity(device.rssi);
  const trend = signalTrend(device.history);
  const stale = device.ageMs > STALE_MS;
  const services = device.serviceUuids
    .map(uuid => serviceName(uuid) ?? `0x${uuid.toString(16).toUpperCase().padStart(4, '0')}`)
    .join(', ');

  return (
    <Screen
      title={device.name ?? t.kinds[kind]}
      subtitle={maker ?? undefined}
      onBack={back}
      backLabel={s.devices.title}
    >
      <Card style={{ gap: theme.spacing.md }}>
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <Icon name={BT_KIND_ICON[kind]} color={theme.colors.accent} />
          <AppText variant="heading" style={styles.flex}>
            {t.finderTitle}
          </AppText>
        </View>
        <AppText variant="caption" color="textSecondary">
          {t.finderHint}
        </AppText>
        <View
          testID="bt-finder"
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${t.proximity[near]}, ${device.rssi} dBm, ${t.trend[trend]}`}
          style={[styles.center, { gap: theme.spacing.xs }]}
        >
          <AppText variant="hero" color={stale ? 'textMuted' : PROXIMITY_COLOR[near]}>
            {`${device.rssi}`}
          </AppText>
          <AppText variant="caption" color="textMuted">
            dBm
          </AppText>
          <AppText variant="title" color={stale ? 'textMuted' : PROXIMITY_COLOR[near]}>
            {t.proximity[near]}
          </AppText>
          <AppText testID="bt-trend" variant="body" color="textSecondary">
            {stale ? t.notVisible : t.trend[trend]}
          </AppText>
        </View>
        <ProgressBar value={rssiFill(device.rssi)} label={t.proximity[near]} />
        <View style={styles.center}>
          <Sparkline
            values={device.history}
            color={theme.colors.accent}
            min={-100}
            max={-40}
            width={240}
            height={48}
          />
        </View>
        <AppText variant="caption" color="textMuted" align="center">
          {t.distance(String(estimateDistance(device.rssi, device.txPower)))}
        </AppText>
        {scanning ? null : <Button testID="bt-rescan" label={t.scan} onPress={() => startScan()} />}
      </Card>

      <SectionHeader title={t.details} />
      <Card>
        <InfoRow label={s.lan.device.kind} value={t.kinds[kind]} mono={false} />
        {maker ? <InfoRow label={t.maker} value={maker} mono={false} /> : null}
        <InfoRow label={t.signal} value={`${device.rssi} dBm`} />
        {device.txPower !== null ? (
          <InfoRow label={t.txPower} value={`${device.txPower} dBm`} />
        ) : null}
        <InfoRow label={t.connectable} value={device.connectable ? s.common.yes : s.common.no} />
        {services ? <InfoRow label={t.services} value={services} mono={false} /> : null}
        <InfoRow label={t.address} value={device.address} />
        <AppText variant="caption" color="textMuted">
          {t.addressHint}
        </AppText>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
  },
  flex: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
