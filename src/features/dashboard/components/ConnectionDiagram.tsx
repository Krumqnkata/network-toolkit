import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Line } from 'react-native-svg';

import { useTheme, type ThemeColors } from '../../../app/theme';
import { AppText } from '../../../components/common';
import { Icon, type IconName } from '../../../components/icons/Icon';

export interface DiagramNode {
  icon: IconName;
  title: string;
  subtitle: string | null;
  status?: { text: string; color: keyof ThemeColors } | null;
}

/** Provider → this phone, joined by a dashed line coloured by the connection state. */
export function ConnectionDiagram({
  left,
  right,
  lineColor,
  accessibilityLabel,
}: {
  left: DiagramNode;
  right: DiagramNode;
  lineColor: keyof ThemeColors;
  accessibilityLabel: string;
}) {
  const theme = useTheme();

  const node = (item: DiagramNode, testID: string) => (
    <View testID={testID} style={[styles.node, { gap: theme.spacing.xs }]}>
      <View
        style={[
          styles.badge,
          { backgroundColor: theme.colors.surfaceRaised, borderRadius: theme.radius.lg },
        ]}
      >
        <Icon name={item.icon} color={theme.colors.accent} size={36} />
      </View>
      <AppText variant="heading" align="center" numberOfLines={2}>
        {item.title}
      </AppText>
      {item.subtitle ? (
        <AppText variant="mono" color="textSecondary" align="center" numberOfLines={1}>
          {item.subtitle}
        </AppText>
      ) : null}
      {item.status ? (
        <AppText variant="body" color={item.status.color} align="center">
          {item.status.text}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel}
      style={[styles.row, { paddingVertical: theme.spacing.sm }]}
    >
      {node(left, 'diagram-provider')}
      <View style={styles.line}>
        <Svg width="100%" height={4}>
          <Line
            x1="0"
            y1="2"
            x2="100%"
            y2="2"
            stroke={theme.colors[lineColor]}
            strokeWidth={2}
            strokeDasharray="8 6"
          />
        </Svg>
      </View>
      {node(right, 'diagram-device')}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    height: 72,
    justifyContent: 'center',
    width: 72,
  },
  line: {
    flex: 0.6,
    marginTop: 34,
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
