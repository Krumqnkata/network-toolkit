import React from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { useTheme } from '../../../app/theme';
import { AppText } from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import { latencyRating } from '../../../domain/algorithms/plain';
import { useStrings } from '../../../i18n';
import type { LatencyTarget } from '../../../stores/homeStore';
import { RATING_COLOR } from './FactorsCard';

/** Horizontal row of sites with their response time; tapping one opens Ping. */
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
            style={[styles.item, { marginRight: theme.spacing.md, gap: theme.spacing.xs }]}
          >
            <Icon
              name={target.id === 'gateway' ? 'router' : 'globe'}
              color={theme.colors.textSecondary}
              size={28}
            />
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    width: 96,
  },
});
