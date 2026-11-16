import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { AppText } from '../../../components/common';
import { EquipmentPicture } from '../../../components/illustrations/EquipmentPicture';
import { latencyRating } from '../../../domain/algorithms/plain';
import { useStrings } from '../../../i18n';
import type { LatencyTarget } from '../../../stores/homeStore';
import { RATING_COLOR } from './FactorsCard';

/** Sites and the router in equal columns, with their response time; tapping one opens Ping. */
export function LatencyRow({
  targets,
  latency,
  loading,
  onOpen,
}: {
  targets: readonly LatencyTarget[];
  latency: Record<string, number | null>;
  loading: boolean;
  onOpen: (host: string) => void;
}) {
  const theme = useTheme();
  const s = useStrings();
  return (
    <View style={[styles.row, { gap: theme.spacing.xs }]}>
      {targets.map(target => {
        const ms = latency[target.id];
        const rating = latencyRating(ms ?? null);
        const value =
          ms === undefined
            ? loading
              ? '…'
              : '—'
            : ms === null
            ? s.home.noReply
            : `${Math.round(ms)} ms`;
        return (
          <Pressable
            key={target.id}
            testID={`latency-${target.id}`}
            accessibilityRole="button"
            accessibilityLabel={`${target.label}: ${value}`}
            disabled={!target.host}
            onPress={() => target.host && onOpen(target.host)}
            style={[styles.item, { gap: 2 }]}
          >
            <EquipmentPicture kind={target.id === 'gateway' ? 'router' : 'internet'} size={36} />
            <AppText variant="caption" numberOfLines={1} align="center">
              {target.label}
            </AppText>
            <AppText
              variant="heading"
              color={rating ? RATING_COLOR[rating] : 'textMuted'}
              align="center"
            >
              {value}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    flex: 1,
  },
  row: {
    flexDirection: 'row',
  },
});
