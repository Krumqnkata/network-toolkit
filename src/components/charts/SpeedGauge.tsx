import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../../app/theme';
import { gaugeFraction } from '../../domain/algorithms/speed';
import { AppText } from '../common/AppText';

const SIZE = 220;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
/** 270° arc opening at the bottom. */
const START_DEG = 135;
const SWEEP_DEG = 270;

function point(angleDeg: number): [number, number] {
  const rad = (angleDeg * Math.PI) / 180;
  return [SIZE / 2 + RADIUS * Math.cos(rad), SIZE / 2 + RADIUS * Math.sin(rad)];
}

function arc(fraction: number): string {
  const end = START_DEG + SWEEP_DEG * Math.min(Math.max(fraction, 0.0001), 1);
  const [x1, y1] = point(START_DEG);
  const [x2, y2] = point(end);
  const large = end - START_DEG > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${large} 1 ${x2.toFixed(
    2,
  )} ${y2.toFixed(2)}`;
}

export interface SpeedGaugeProps {
  mbps: number | null;
  valueText: string;
  unit: string;
  caption: string;
  accessibilityLabel: string;
}

/** Arc gauge for the current transfer rate (square-root scale up to 1 Gbit/s). */
export function SpeedGauge({
  mbps,
  valueText,
  unit,
  caption,
  accessibilityLabel,
}: SpeedGaugeProps) {
  const theme = useTheme();
  const fraction = gaugeFraction(mbps);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={styles.wrap}
    >
      <Svg width={SIZE} height={SIZE}>
        <Path
          d={arc(1)}
          stroke={theme.colors.surfaceRaised}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
        />
        {fraction > 0 ? (
          <Path
            d={arc(fraction)}
            stroke={theme.colors.accent}
            strokeWidth={STROKE}
            strokeLinecap="round"
            fill="none"
          />
        ) : null}
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <AppText variant="display" testID="speed-value">
          {valueText}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {unit}
        </AppText>
        <AppText variant="caption" color="textMuted" style={styles.caption}>
          {caption}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: {
    marginTop: 4,
  },
  center: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  wrap: {
    alignSelf: 'center',
    height: SIZE,
    width: SIZE,
  },
});
