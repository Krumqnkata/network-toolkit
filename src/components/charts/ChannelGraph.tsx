import React, { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

import { useTheme } from '../../app/theme';
import { channelSpan, channelToFrequency } from '../../domain/algorithms/wifiAnalysis';
import type { ScannedNetwork } from '../../domain/models/wifiScan';

export type GraphBand = '2.4' | '5' | '6';

const DOMAIN_MHZ: Record<GraphBand, [number, number]> = {
  '2.4': [2400, 2496],
  '5': [5160, 5860],
  '6': [5940, 7130],
};

const TICKS: Record<GraphBand, readonly number[]> = {
  '2.4': [1, 3, 5, 7, 9, 11, 13],
  '5': [36, 52, 100, 116, 132, 149, 165],
  '6': [1, 33, 65, 97, 129, 161, 193, 225],
};

const DBM_MIN = -100;
const DBM_MAX = -20;
const GRID_DBM = [-90, -70, -50, -30];
const LABELED_NETWORKS = 6;
const PADDING = { top: 16, right: 8, bottom: 22, left: 30 };

export interface ChannelGraphProps {
  band: GraphBand;
  /** Networks in this band, strongest first. */
  networks: readonly ScannedNetwork[];
  colorFor: (network: ScannedNetwork) => string;
  connectedBssid: string | null;
  accessibilityLabel: string;
  height?: number;
}

function shorten(label: string, max = 12): string {
  return label.length > max ? `${label.slice(0, max - 1)}…` : label;
}

/**
 * Classic Wi-Fi analyzer view: every network is drawn as a curve spanning the
 * spectrum it occupies, with its height at the received signal level.
 */
export function ChannelGraph({
  band,
  networks,
  colorFor,
  connectedBssid,
  accessibilityLabel,
  height = 220,
}: ChannelGraphProps) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  const [minMhz, maxMhz] = DOMAIN_MHZ[band];
  const plotWidth = Math.max(0, width - PADDING.left - PADDING.right);
  const plotHeight = height - PADDING.top - PADDING.bottom;
  const x = (mhz: number) =>
    PADDING.left +
    ((Math.min(maxMhz, Math.max(minMhz, mhz)) - minMhz) / (maxMhz - minMhz)) * plotWidth;
  const y = (dbm: number) =>
    PADDING.top +
    ((DBM_MAX - Math.min(DBM_MAX, Math.max(DBM_MIN, dbm))) / (DBM_MAX - DBM_MIN)) * plotHeight;

  const curves = networks
    .map(network => ({ network, span: channelSpan(network) }))
    .filter(item => item.span !== null && item.span.band === band)
    // Draw weak networks first so strong ones stay on top.
    .reverse();

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
          {GRID_DBM.map(dbm => (
            <G key={dbm}>
              <Line
                x1={PADDING.left}
                x2={width - PADDING.right}
                y1={y(dbm)}
                y2={y(dbm)}
                stroke={theme.chart.grid}
                strokeWidth={1}
              />
              <SvgText
                x={PADDING.left - 4}
                y={y(dbm) + 3}
                fontSize={9}
                fill={theme.colors.textMuted}
                textAnchor="end"
              >
                {dbm}
              </SvgText>
            </G>
          ))}

          {TICKS[band].map(channel => {
            const frequency = channelToFrequency(band, channel);
            if (frequency === null) return null;
            return (
              <SvgText
                key={channel}
                x={x(frequency)}
                y={height - 6}
                fontSize={10}
                fill={theme.colors.textMuted}
                textAnchor="middle"
              >
                {channel}
              </SvgText>
            );
          })}

          {curves.map(({ network, span }) => {
            if (!span) return null;
            const color = colorFor(network);
            const left = x(span.lowMhz);
            const right = x(span.highMhz);
            const shoulder = (right - left) * 0.2;
            const top = y(network.rssi);
            const floor = y(DBM_MIN);
            const connected = connectedBssid !== null && network.bssid === connectedBssid;
            const d = [
              `M ${left} ${floor}`,
              `Q ${left} ${top} ${left + shoulder} ${top}`,
              `L ${right - shoulder} ${top}`,
              `Q ${right} ${top} ${right} ${floor}`,
            ].join(' ');
            return (
              <Path
                key={network.bssid ?? `${network.ssid}-${network.frequencyMhz}`}
                d={d}
                fill={color}
                fillOpacity={connected ? 0.28 : 0.12}
                stroke={color}
                strokeWidth={connected ? 2.5 : 1.25}
              />
            );
          })}

          {networks.slice(0, LABELED_NETWORKS).map(network => {
            const span = channelSpan(network);
            if (!span || span.band !== band) return null;
            return (
              <SvgText
                key={`label-${network.bssid ?? network.ssid}`}
                x={x(span.centerMhz)}
                y={Math.max(PADDING.top - 4, y(network.rssi) - 4)}
                fontSize={10}
                fontWeight="600"
                fill={colorFor(network)}
                textAnchor="middle"
              >
                {shorten(network.ssid ?? '•••')}
              </SvgText>
            );
          })}
        </Svg>
      ) : null}
    </View>
  );
}
