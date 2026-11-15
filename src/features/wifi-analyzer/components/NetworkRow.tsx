import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { AppText, Badge } from '../../../components/common';
import { Sparkline } from '../../../components/charts/Sparkline';
import {
  classifySignal,
  frequencyToChannel,
  wifiStandardLabel,
} from '../../../domain/algorithms/wifi';
import {
  parseSecurity,
  supportsWps,
  type RssiSample,
} from '../../../domain/algorithms/wifiAnalysis';
import type { ScannedNetwork } from '../../../domain/models/wifiScan';
import { useStrings } from '../../../i18n';

export interface NetworkRowProps {
  network: ScannedNetwork;
  color: string;
  connected: boolean;
  history: readonly RssiSample[];
  showDivider: boolean;
}

export function NetworkRow({ network, color, connected, history, showDivider }: NetworkRowProps) {
  const theme = useTheme();
  const s = useStrings();
  const a = s.wifiAnalyzer;
  const channel = frequencyToChannel(network.frequencyMhz);
  const security = parseSecurity(network.capabilities);
  const standard = wifiStandardLabel(network.wifiStandard);
  const quality = classifySignal(network.rssi);
  const name = network.ssid ?? a.hidden;

  const details = [
    channel === null ? null : a.channelShort(String(channel)),
    network.channelWidthMhz ? `${network.channelWidthMhz} MHz` : null,
    `${network.frequencyMhz} MHz`,
  ]
    .filter(Boolean)
    .join(' · ');
  const tags = [a.security[security], supportsWps(network.capabilities) ? a.wps : null, standard]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      accessible
      accessibilityLabel={[
        name,
        connected ? a.connected : null,
        `${network.rssi} dBm, ${s.signalQuality[quality]}`,
        details,
        tags,
        network.bssid,
      ]
        .filter(Boolean)
        .join(', ')}
      style={[
        styles.row,
        {
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.md,
        },
        showDivider && {
          borderBottomColor: theme.colors.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
        },
      ]}
    >
      <View style={[styles.swatch, { backgroundColor: color, borderRadius: theme.radius.pill }]} />
      <View style={[styles.body, { gap: 2 }]}>
        <View style={[styles.titleLine, { gap: theme.spacing.sm }]}>
          <AppText
            variant="heading"
            color={network.ssid ? 'textPrimary' : 'textMuted'}
            numberOfLines={1}
            style={styles.title}
          >
            {name}
          </AppText>
          {connected ? <Badge label={a.connected} tone="accent" /> : null}
        </View>
        <AppText variant="caption" color="textSecondary">
          {details}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {tags}
        </AppText>
        {network.bssid ? (
          <AppText variant="caption" color="textMuted" style={{ fontFamily: 'monospace' }}>
            {network.bssid}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.signal, { gap: theme.spacing.xs }]}>
        <AppText variant="mono">{`${network.rssi} dBm`}</AppText>
        <Sparkline values={history.map(sample => sample.rssi)} color={color} min={-100} max={-30} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  signal: {
    alignItems: 'flex-end',
  },
  swatch: {
    height: 10,
    marginTop: 6,
    width: 10,
  },
  title: {
    flexShrink: 1,
  },
  titleLine: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
