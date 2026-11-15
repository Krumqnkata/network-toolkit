import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '../../app/theme';
import { classifySignal, signalPercent, type SignalQuality } from '../../domain/algorithms/wifi';
import { AppText } from '../common/AppText';

const QUALITY_COLOR: Record<SignalQuality, keyof ThemeColors> = {
  excellent: 'success',
  good: 'success',
  fair: 'warning',
  weak: 'warning',
  poor: 'danger',
};

export interface SignalMeterProps {
  rssi: number;
  qualityLabel: (quality: SignalQuality) => string;
  label: string;
}

/** Horizontal signal-strength bar with dBm readout and qualitative rating. */
export function SignalMeter({ rssi, qualityLabel, label }: SignalMeterProps) {
  const theme = useTheme();
  const quality = classifySignal(rssi);
  const percent = signalPercent(rssi);
  const color = theme.colors[QUALITY_COLOR[quality]];

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${label}: ${rssi} dBm, ${qualityLabel(quality)}`}
      accessibilityValue={{ min: 0, max: 100, now: percent }}
      style={{ gap: theme.spacing.sm }}
    >
      <View style={styles.header}>
        <AppText variant="caption" color="textMuted">
          {label}
        </AppText>
        <View style={[styles.reading, { gap: theme.spacing.sm }]}>
          <AppText variant="heading" style={{ color }}>
            {qualityLabel(quality)}
          </AppText>
          <AppText variant="mono">{`${rssi} dBm`}</AppText>
        </View>
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
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    height: '100%',
  },
  header: {
    alignItems: 'baseline',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  reading: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
  track: {
    height: 8,
    overflow: 'hidden',
  },
});
