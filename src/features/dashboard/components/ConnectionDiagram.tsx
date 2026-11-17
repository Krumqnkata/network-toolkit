import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { useTheme, type ThemeColors } from '../../../app/theme';
import { AppText } from '../../../components/common';
import { EquipmentPicture } from '../../../components/illustrations/EquipmentPicture';

export interface DiagramNode {
  id: string;
  /** Equipment picture: `provider`, `operator`, `router`, `phone`… */
  picture: string;
  title: string;
  subtitle: string | null;
  status?: { text: string; color: keyof ThemeColors } | null;
}

export interface DiagramLink {
  color: keyof ThemeColors;
  /** Small label over the line, e.g. "4 ms". */
  label?: string | null;
  dashed?: boolean;
}

/** Provider → router → this phone, with pictures of the equipment and coloured links. */
export function ConnectionDiagram({
  nodes,
  links,
  accessibilityLabel,
}: {
  nodes: DiagramNode[];
  /** One fewer than `nodes`: the link after each node. */
  links: DiagramLink[];
  accessibilityLabel: string;
}) {
  const theme = useTheme();

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, { paddingVertical: theme.spacing.sm }]}
    >
      {nodes.map((node, index) => {
        const link = links[index];
        return (
          <React.Fragment key={node.id}>
            <View testID={`diagram-${node.id}`} style={[styles.node, { gap: 2 }]}>
              <EquipmentPicture kind={node.picture} size={nodes.length > 2 ? 60 : 68} />
              <AppText variant="heading" align="center" numberOfLines={3} fit>
                {node.title}
              </AppText>
              {node.subtitle ? (
                <AppText
                  variant="mono"
                  color="textSecondary"
                  align="center"
                  style={styles.address}
                  fit
                >
                  {node.subtitle}
                </AppText>
              ) : null}
              {node.status ? (
                <AppText
                  variant="caption"
                  color={node.status.color}
                  align="center"
                  numberOfLines={2}
                  fit
                >
                  {node.status.text}
                </AppText>
              ) : null}
            </View>
            {link && index < nodes.length - 1 ? (
              <View style={styles.link}>
                <AppText
                  variant="caption"
                  color={link.color}
                  align="center"
                  style={styles.linkLabel}
                  fit
                >
                  {link.label ?? ' '}
                </AppText>
                <Svg width="100%" height={4}>
                  <Line
                    x1="0"
                    y1="2"
                    x2="100%"
                    y2="2"
                    stroke={theme.colors[link.color]}
                    strokeWidth={2.5}
                    strokeDasharray={link.dashed ? '6 5' : undefined}
                  />
                </Svg>
              </View>
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  address: {
    fontSize: 11,
  },
  link: {
    flex: 0.45,
    marginTop: 18,
  },
  linkLabel: {
    fontSize: 11,
    marginBottom: 2,
  },
  node: {
    alignItems: 'center',
    flex: 1,
  },
  row: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
});
