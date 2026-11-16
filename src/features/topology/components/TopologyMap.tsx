import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme, type ThemeColors } from '../../../app/theme';
import { AppText } from '../../../components/common';
import { Icon, type IconName } from '../../../components/icons/Icon';
import type { BluetoothKind } from '../../../domain/algorithms/bluetooth';
import type { DeviceKind } from '../../../domain/algorithms/devices';
import {
  NODE_WIDTH,
  layoutTopology,
  type LinkState,
  type TopoLink,
  type TopoNode,
  type Topology,
} from '../../../domain/algorithms/topology';
import { useStrings } from '../../../i18n';
import { BT_KIND_ICON } from '../../bluetooth/components/bluetoothIcon';
import { KIND_ICON } from '../../lan-scanner/components/deviceIcon';

const BUBBLE = 52;

export const LINK_COLOR: Record<LinkState, keyof ThemeColors> = {
  good: 'success',
  warn: 'warning',
  bad: 'danger',
  unknown: 'textMuted',
};

const DASH: Record<TopoLink, string | undefined> = {
  path: undefined,
  wired: undefined,
  lan: undefined,
  wireless: '6 5',
  mesh: '6 5',
  cellular: '6 5',
  bluetooth: '2 5',
};

export function nodeIcon(node: TopoNode): IconName {
  switch (node.type) {
    case 'internet':
      return 'globe';
    case 'hop':
      return node.kind === 'router' ? 'router' : 'route';
    case 'more':
      return 'route';
    case 'operator':
      return 'antenna';
    case 'router':
      return 'router';
    case 'ap':
      return 'wifi';
    case 'self':
      return 'phone';
    case 'lan':
      return KIND_ICON[node.kind as DeviceKind] ?? 'device';
    case 'bluetooth':
      return BT_KIND_ICON[node.kind as BluetoothKind] ?? 'bluetooth';
  }
}

/** Name shown under a node: what the scan found, or what kind of node it is. */
export function useNodeTitle() {
  const s = useStrings();
  const t = s.topology;
  return (node: TopoNode) => {
    if (node.type === 'more') return t.types.more(node.count ?? 0);
    if (node.type === 'self') return t.types.self;
    if (node.name) return node.name;
    // Unnamed devices are labelled with the type the scan guessed.
    if (node.type === 'lan') return s.lan.kinds[node.kind as DeviceKind] ?? t.types.lan;
    if (node.type === 'bluetooth') {
      return s.bluetooth.kinds[node.kind as BluetoothKind] ?? t.types.bluetooth;
    }
    return t.types[node.type];
  };
}

/**
 * Draws the topology: links as curves coloured by their state, nodes as
 * icons with a name and address. Tapping a node selects it.
 */
export function TopologyMap({
  topology,
  width,
  selected,
  onSelect,
}: {
  topology: Topology;
  width: number;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const theme = useTheme();
  const title = useNodeTitle();
  const layout = useMemo(() => layoutTopology(topology, width), [topology, width]);

  const links = topology.nodes.flatMap(node => {
    const from = node.parent ? layout.positions[node.parent] : undefined;
    const to = layout.positions[node.id];
    if (!from || !to || !node.link) return [];
    const startY = from.y + BUBBLE / 2;
    const endY = to.y - BUBBLE / 2;
    const middle = (startY + endY) / 2;
    return [
      {
        id: node.id,
        d: `M ${from.x} ${startY} C ${from.x} ${middle}, ${to.x} ${middle}, ${to.x} ${endY}`,
        color: theme.colors[LINK_COLOR[node.linkState]],
        dash: DASH[node.link],
        width: node.link === 'lan' || node.link === 'bluetooth' ? 1.5 : 2.5,
      },
    ];
  });

  return (
    <View testID="topology-map" style={{ width, height: layout.height }}>
      <Svg width={width} height={layout.height} style={StyleSheet.absoluteFill}>
        {links.map(link => (
          <Path
            key={link.id}
            d={link.d}
            stroke={link.color}
            strokeWidth={link.width}
            strokeDasharray={link.dash}
            strokeLinecap="round"
            fill="none"
          />
        ))}
      </Svg>
      {topology.nodes.map(node => {
        const position = layout.positions[node.id];
        if (!position) return null;
        const isSelected = node.id === selected;
        const highlight = node.type === 'self' || node.connected;
        const name = title(node);
        return (
          <Pressable
            key={node.id}
            testID={`topo-node-${node.id}`}
            accessibilityRole="button"
            accessibilityLabel={[name, node.address].filter(Boolean).join(', ')}
            accessibilityState={{ selected: isSelected }}
            onPress={() => onSelect(node.id)}
            style={[
              styles.node,
              {
                left: position.x - NODE_WIDTH / 2,
                top: position.y - BUBBLE / 2,
                width: NODE_WIDTH,
              },
            ]}
          >
            <View
              style={[
                styles.bubble,
                {
                  backgroundColor: highlight
                    ? theme.colors.accentMuted
                    : theme.colors.surfaceRaised,
                  borderColor: isSelected
                    ? theme.colors.accent
                    : node.type === 'hop' && !node.address
                    ? theme.colors.border
                    : 'transparent',
                },
              ]}
            >
              <Icon
                name={nodeIcon(node)}
                color={
                  node.type === 'hop' && !node.address
                    ? theme.colors.textMuted
                    : theme.colors.accent
                }
                size={24}
              />
            </View>
            <AppText variant="caption" align="center" numberOfLines={2} style={styles.label}>
              {name}
            </AppText>
            {node.address && node.type !== 'ap' && node.type !== 'bluetooth' ? (
              <AppText
                variant="caption"
                color="textSecondary"
                align="center"
                numberOfLines={1}
                style={[styles.address, { fontFamily: theme.typography.mono.fontFamily }]}
              >
                {node.address}
              </AppText>
            ) : node.detail && node.type === 'ap' ? (
              <AppText variant="caption" color="textSecondary" align="center" numberOfLines={1}>
                {node.detail}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  address: {
    fontSize: 10,
  },
  bubble: {
    alignItems: 'center',
    borderRadius: BUBBLE / 2,
    borderWidth: 2,
    height: BUBBLE,
    justifyContent: 'center',
    width: BUBBLE,
  },
  label: {
    marginTop: 4,
  },
  node: {
    alignItems: 'center',
    position: 'absolute',
  },
});
