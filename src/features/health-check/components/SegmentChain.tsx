import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '../../../app/theme';
import { AppText, Card } from '../../../components/common';
import { EquipmentPicture } from '../../../components/illustrations/EquipmentPicture';
import type {
  Segment,
  SegmentId,
  SegmentState,
  Verdict,
} from '../../../domain/algorithms/segments';
import { useStrings } from '../../../i18n';
import type { ProblemLocation } from '../services/problemLocator';

const STATE_COLOR: Record<SegmentState, keyof ThemeColors> = {
  good: 'success',
  warn: 'warning',
  bad: 'danger',
  unknown: 'textSecondary',
};

/** The segment a verdict blames, for highlighting. */
function blamedSegment(verdict: Verdict, cellular: boolean): SegmentId | null {
  switch (verdict) {
    case 'local-wifi':
      return 'local';
    case 'local-radio':
      return cellular ? 'access' : 'local';
    case 'access':
      return 'access';
    case 'internet':
      return 'internet';
    default:
      return null;
  }
}

export function verdictTone(verdict: string): keyof ThemeColors {
  if (verdict === 'none') return 'success';
  if (verdict === 'unknown') return 'textSecondary';
  return 'danger';
}

interface ChainNode {
  id: string;
  /** Equipment picture kind (see EquipmentPicture). */
  icon: string;
  title: string;
  address: string | null;
}

/**
 * "Where is the problem?": this phone → router → provider → internet, each
 * link coloured by its state and labelled with the delay and loss it adds.
 */
export function SegmentChain({
  location,
  transport,
}: {
  location: ProblemLocation;
  transport: string;
}) {
  const theme = useTheme();
  const t = useStrings().health.locator;
  const cellular = transport === 'cellular';
  const verdict = location.verdict as Verdict;
  const blamed = blamedSegment(verdict, cellular);
  const byId = new Map(location.segments.map(segment => [segment.id, segment]));

  // On mobile data there is no router: the first hop is the operator's network.
  const steps: { node: ChainNode; segment: Segment | undefined; label: string }[] = cellular
    ? [
        {
          node: { id: 'phone', icon: 'phone', title: t.nodes.phone, address: null },
          segment: byId.get('access'),
          label: t.links.radio,
        },
        {
          node: {
            id: 'operator',
            icon: 'operator',
            title: t.nodes.operator,
            address: location.provider,
          },
          segment: byId.get('internet'),
          label: t.links.internet,
        },
      ]
    : [
        {
          node: { id: 'phone', icon: 'phone', title: t.nodes.phone, address: null },
          segment: byId.get('local'),
          label: transport === 'wifi' ? t.links.wifi : t.links.cable,
        },
        {
          node: { id: 'router', icon: 'router', title: t.nodes.router, address: location.gateway },
          segment: byId.get('access'),
          label: t.links.provider,
        },
        {
          node: {
            id: 'provider',
            icon: 'provider',
            title: t.nodes.provider,
            address: location.provider,
          },
          segment: byId.get('internet'),
          label: t.links.internet,
        },
      ];
  const last: ChainNode = {
    id: 'internet',
    icon: 'internet',
    title: t.nodes.internet,
    address: location.internet,
  };

  const linkValue = (segment: Segment | undefined) => {
    if (!segment || segment.state === 'unknown' || segment.addedMs === null) {
      return segment?.lossPercent === 100 ? t.linkValue('—', 100) : t.noData;
    }
    return t.linkValue(`+${Math.round(segment.addedMs)} ms`, segment.lossPercent ?? 0);
  };

  const renderNode = (node: ChainNode, problem: boolean) => (
    <View
      key={node.id}
      testID={`chain-node-${node.id}`}
      style={[styles.row, { gap: theme.spacing.md }]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: theme.colors.surfaceRaised,
            borderColor: problem ? theme.colors.danger : 'transparent',
          },
        ]}
      >
        <EquipmentPicture kind={node.icon} size={36} />
      </View>
      <View style={styles.flex}>
        <AppText variant="heading">{node.title}</AppText>
        {node.address ? (
          <AppText variant="mono" color="textSecondary" numberOfLines={1}>
            {node.address}
          </AppText>
        ) : null}
      </View>
    </View>
  );

  const renderLink = (segment: Segment | undefined, label: string, key: string) => {
    const state = segment?.state ?? 'unknown';
    const color = theme.colors[STATE_COLOR[state]];
    const isBlamed = segment !== undefined && segment.id === blamed;
    return (
      <View
        key={key}
        testID={`chain-link-${segment?.id ?? key}`}
        style={[styles.row, { gap: theme.spacing.md }]}
      >
        <View style={styles.rail}>
          <View
            style={[
              styles.bar,
              {
                backgroundColor: color,
                width: isBlamed ? 6 : 3,
                opacity: state === 'unknown' ? 0.4 : 1,
              },
            ]}
          />
        </View>
        <View style={[styles.flex, { paddingVertical: theme.spacing.sm }]}>
          <AppText variant="caption" color="textSecondary">
            {label}
          </AppText>
          <AppText variant="body" color={STATE_COLOR[state]}>
            {linkValue(segment)}
          </AppText>
        </View>
      </View>
    );
  };

  const routerSilent = verdict === 'router';
  const accessibilityLabel = `${t.title} ${t.verdict[verdict] ?? ''}`;

  return (
    <Card>
      <View testID="segment-chain" accessible accessibilityLabel={accessibilityLabel}>
        {steps.map(({ node, segment, label }) => (
          <React.Fragment key={node.id}>
            {renderNode(node, routerSilent && node.id === 'router')}
            {renderLink(segment, label, `${node.id}-link`)}
          </React.Fragment>
        ))}
        {renderNode(last, false)}
      </View>
      <View style={{ marginTop: theme.spacing.md, gap: theme.spacing.xs }}>
        <AppText testID="locator-verdict" variant="heading" color={verdictTone(verdict)}>
          {t.verdict[verdict] ?? t.verdict.unknown}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {t.advice[verdict] ?? t.advice.unknown}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 3,
    flex: 1,
  },
  bubble: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 2,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  flex: {
    flex: 1,
  },
  rail: {
    alignItems: 'center',
    alignSelf: 'stretch',
    width: 44,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
