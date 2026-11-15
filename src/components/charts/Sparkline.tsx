import React from 'react';
import Svg, { Polyline } from 'react-native-svg';

export interface SparklineProps {
  values: readonly number[];
  color: string;
  min: number;
  max: number;
  width?: number;
  height?: number;
}

/** Tiny trend line; decorative, so it is hidden from screen readers. */
export function Sparkline({ values, color, min, max, width = 56, height = 18 }: SparklineProps) {
  if (values.length < 2) return null;
  const step = width / (values.length - 1);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const clamped = Math.min(max, Math.max(min, value));
      const py = height - 1 - ((clamped - min) / range) * (height - 2);
      return `${(index * step).toFixed(1)},${py.toFixed(1)}`;
    })
    .join(' ');
  return (
    <Svg
      width={width}
      height={height}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Polyline points={points} fill="none" stroke={color} strokeWidth={1.5} />
    </Svg>
  );
}
