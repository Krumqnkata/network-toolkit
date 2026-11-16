import React, { forwardRef, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type Svg from 'react-native-svg';

import { useTheme, type Theme } from '../../../app/theme';
import type { BluetoothKind } from '../../../domain/algorithms/bluetooth';
import type { DeviceKind } from '../../../domain/algorithms/devices';
import type { TopoNode, Topology } from '../../../domain/algorithms/topology';
import { useStrings, type Strings } from '../../../i18n';
import { SceneSvg } from '../scene/SceneSvg';
import { buildMapScene, type ScenePalette, type SceneOptions } from '../scene/scene';

/** Name shown under a node: what the scan found, or what kind of node it is. */
export function nodeTitle(node: TopoNode, s: Strings): string {
  const t = s.topology;
  if (node.type === 'self') return t.types.self;
  if (node.name) return node.name;
  // Unnamed devices are labelled with the type the scan guessed.
  if (node.type === 'lan') return s.lan.kinds[node.kind as DeviceKind] ?? t.types.lan;
  if (node.type === 'bluetooth') {
    return s.bluetooth.kinds[node.kind as BluetoothKind] ?? t.types.bluetooth;
  }
  return t.types[node.type];
}

export function useNodeTitle() {
  const s = useStrings();
  return (node: TopoNode) => nodeTitle(node, s);
}

export function scenePalette(theme: Theme, background: string): ScenePalette {
  return {
    background,
    text: theme.colors.textPrimary,
    textSecondary: theme.colors.textSecondary,
    textMuted: theme.colors.textMuted,
    accent: theme.colors.accent,
    line: theme.colors.textMuted,
    states: {
      good: theme.colors.success,
      warn: theme.colors.warning,
      bad: theme.colors.danger,
      unknown: theme.colors.textMuted,
    },
  };
}

export function sceneLabels(s: Strings): SceneOptions['labels'] {
  const t = s.topology;
  return {
    devices: t.devicesGroup,
    bluetooth: t.bluetoothGroup,
    ms: ms => `+${Math.round(ms)} ms`,
    noAnswer: t.notReachedDelay,
  };
}

/**
 * The network map: equipment pictures joined by lines coloured by the delay
 * each link adds. Invisible buttons over the pictures make nodes tappable.
 */
export const TopologyMap = forwardRef<
  Svg,
  {
    topology: Topology;
    width: number;
    selected: string | null;
    onSelect: (id: string) => void;
  }
>(function TopologyMapView({ topology, width, selected, onSelect }, ref) {
  const theme = useTheme();
  const s = useStrings();
  const scene = useMemo(
    () =>
      buildMapScene(topology, {
        width,
        palette: scenePalette(theme, theme.colors.surface),
        title: node => nodeTitle(node, s),
        selected,
        labels: sceneLabels(s),
      }),
    [topology, width, theme, s, selected],
  );
  const byId = new Map(topology.nodes.map(node => [node.id, node]));

  return (
    <View testID="topology-map" style={{ width, height: scene.height }}>
      <SceneSvg ref={ref} scene={scene} />
      {scene.hits.map(hit => {
        const node = byId.get(hit.id);
        if (!node) return null;
        return (
          <Pressable
            key={hit.id}
            testID={`topo-node-${hit.id}`}
            accessibilityRole="button"
            accessibilityLabel={[nodeTitle(node, s), node.address].filter(Boolean).join(', ')}
            accessibilityState={{ selected: hit.id === selected }}
            onPress={() => onSelect(hit.id)}
            style={[styles.hit, { left: hit.x, top: hit.y, width: hit.w, height: hit.h }]}
          />
        );
      })}
    </View>
  );
});

const styles = StyleSheet.create({
  hit: {
    position: 'absolute',
  },
});
