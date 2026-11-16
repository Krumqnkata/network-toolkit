import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';

import { useTheme } from '../../app/theme';

export interface LatencyChartProps {
  /** Round-trip times in ms; null marks a lost probe. */
  values: readonly (number | null)[];
  accessibilityLabel: string;
  height?: number;
  /** Number of most recent values shown. */
  window?: number;
}

/** Bar chart of recent round-trip times; lost probes are drawn as short red ticks. */
export function LatencyChart({
  values,
  accessibilityLabel,
  height = 96,
  window = 60,
}: LatencyChartProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const shown = values.slice(-window);
  const max = Math.max(10, ...shown.map(value => value ?? 0)) * 1.1;
  const slot = width / window;
  const barWidth = Math.max(1, slot * 0.7);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      style={{ height }}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Line
            x1={0}
            x2={width}
            y1={height - 0.5}
            y2={height - 0.5}
            stroke={theme.chart.grid}
            strokeWidth={1}
          />
          {shown.map((value, index) => {
            const x = index * slot + (slot - barWidth) / 2;
            if (value === null) {
              return (
                <Rect
                  key={index}
                  x={x}
                  y={height - 6}
                  width={barWidth}
                  height={6}
                  fill={theme.colors.danger}
                />
              );
            }
            const barHeight = Math.max(2, (value / max) * (height - 4));
            return (
              <Rect
                key={index}
                x={x}
                y={height - barHeight}
                width={barWidth}
                height={barHeight}
                rx={Math.min(2, barWidth / 2)}
                fill={theme.colors.accent}
              />
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
