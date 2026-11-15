import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '../../../app/theme';
import { AppText, Badge, Card, InfoRow } from '../../../components/common';
import { frequencyToChannel } from '../../../domain/algorithms/wifi';
import {
  congestionFor,
  rankChannels,
  type ChannelLoad,
} from '../../../domain/algorithms/wifiAnalysis';
import type { ScannedNetwork } from '../../../domain/models/wifiScan';
import { useStrings } from '../../../i18n';

const LOAD_COLOR: Record<ChannelLoad, keyof ThemeColors> = {
  clear: 'success',
  light: 'success',
  moderate: 'warning',
  busy: 'danger',
};

const SHOWN = 3;

export interface ChannelRecommendationsProps {
  band: '2.4' | '5' | '6';
  networks: readonly ScannedNetwork[];
  connected: ScannedNetwork | null;
}

export function ChannelRecommendations({ band, networks, connected }: ChannelRecommendationsProps) {
  const theme = useTheme();
  const s = useStrings();
  const a = s.wifiAnalyzer;
  const ranking = rankChannels(band, networks).slice(0, SHOWN);
  const own = connected ? congestionFor(connected, networks) : null;
  const ownChannel = connected ? frequencyToChannel(connected.frequencyMhz) : null;

  return (
    <Card testID="channel-recommendations" style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xxs }}>
        <AppText variant="heading" accessibilityRole="header">
          {a.recommendationsTitle}
        </AppText>
        <AppText variant="caption" color="textMuted">
          {a.recommendationsHint}
        </AppText>
      </View>
      <View style={[styles.chips, { gap: theme.spacing.sm }]}>
        {ranking.map(item => (
          <View
            key={item.channel}
            accessible
            accessibilityLabel={`${s.dashboard.fields.channel} ${item.channel}: ${
              a.load[item.load]
            }${item.dfs ? `, ${a.dfs}` : ''}`}
            style={[
              styles.chip,
              {
                backgroundColor: theme.colors.surfaceRaised,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
                gap: theme.spacing.xxs,
              },
            ]}
          >
            <AppText variant="title">{item.channel}</AppText>
            <AppText variant="caption" color={LOAD_COLOR[item.load]}>
              {a.load[item.load]}
            </AppText>
            {item.dfs ? <Badge label={a.dfs} /> : null}
          </View>
        ))}
      </View>
      {connected && own && ownChannel !== null ? (
        <InfoRow
          label={a.yourNetwork}
          value={`${a.yourNetworkLoad(String(ownChannel), own.overlapping)} · ${a.load[own.load]}`}
          mono={false}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    flex: 1,
  },
  chips: {
    flexDirection: 'row',
  },
});
