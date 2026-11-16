import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '../../../app/theme';
import { Sparkline } from '../../../components/charts/Sparkline';
import { AppText, Card } from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import { classifySignal, signalPercent, type SignalQuality } from '../../../domain/algorithms/wifi';
import type { WifiLink } from '../../../domain/models/network';
import { useStrings } from '../../../i18n';
import { formatBand, formatChannel, formatMbps } from '../format';

const QUALITY_COLOR: Record<SignalQuality, keyof ThemeColors> = {
  excellent: 'success',
  good: 'success',
  fair: 'warning',
  weak: 'warning',
  poor: 'danger',
};

export interface SignalCardProps {
  wifi: WifiLink;
  /** Recent RSSI readings, oldest first. */
  history: readonly number[];
  onPress: () => void;
}

/** Wi-Fi signal at a glance: dBm, quality, a bar, band/channel/link speed and a trend line. */
export function SignalCard({ wifi, history, onPress }: SignalCardProps) {
  const theme = useTheme();
  const s = useStrings();
  const t = s.home;
  if (wifi.rssi === null) return null;
  const quality = classifySignal(wifi.rssi);
  const color = theme.colors[QUALITY_COLOR[quality]];
  const percent = signalPercent(wifi.rssi);
  const details = [
    formatBand(wifi.frequencyMhz),
    formatChannel(wifi.frequencyMhz),
    formatMbps(wifi.linkSpeedMbps),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Pressable
      testID="home-signal"
      accessibilityRole="button"
      accessibilityLabel={t.signalLabel(wifi.rssi, s.signalQuality[quality])}
      onPress={onPress}
    >
      <Card style={{ gap: theme.spacing.md }}>
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <Icon name="wifi" color={theme.colors.accent} size={20} />
          <AppText variant="overline" color="textSecondary" style={styles.flex}>
            {t.signal}
          </AppText>
          <Icon name="chevronRight" color={theme.colors.textMuted} size={18} />
        </View>
        <View style={[styles.row, { gap: theme.spacing.md }]}>
          <View style={styles.flex}>
            <View style={[styles.value, { gap: theme.spacing.xs }]}>
              <AppText variant="hero" testID="home-rssi">
                {wifi.rssi}
              </AppText>
              <AppText variant="body" color="textMuted">
                dBm
              </AppText>
            </View>
            <AppText variant="heading" style={{ color }}>
              {s.signalQuality[quality]}
            </AppText>
          </View>
          <Sparkline
            values={history}
            color={theme.colors.accent}
            min={-90}
            max={-30}
            width={120}
            height={44}
          />
        </View>
        <View
          style={[
            styles.track,
            { backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radius.pill },
          ]}
        >
          <View
            style={[
              styles.fill,
              { width: `${percent}%`, backgroundColor: color, borderRadius: theme.radius.pill },
            ]}
          />
        </View>
        {details ? (
          <AppText variant="mono" color="textSecondary">
            {details}
          </AppText>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: {
    height: '100%',
  },
  flex: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  track: {
    height: 6,
    overflow: 'hidden',
  },
  value: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
});
