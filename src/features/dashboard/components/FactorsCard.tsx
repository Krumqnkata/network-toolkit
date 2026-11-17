import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '../../../app/theme';
import { AppText, Card } from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import type { Rating } from '../../../domain/algorithms/plain';
import { useStrings } from '../../../i18n';

export const RATING_COLOR: Record<Rating, keyof ThemeColors> = {
  great: 'success',
  good: 'success',
  ok: 'warning',
  poor: 'danger',
};

export interface Factor {
  label: string;
  value: string;
  color?: keyof ThemeColors;
}

/** Card listing what affects speed (operator, standard, signal …) with an overall check mark. */
export function FactorsCard({
  title,
  factors,
  rating,
}: {
  title: string;
  factors: readonly Factor[];
  rating: Rating | null;
}) {
  const theme = useTheme();
  const s = useStrings();
  return (
    <Card testID="factors-card" style={{ gap: theme.spacing.sm }}>
      <View style={[styles.header, { gap: theme.spacing.sm }]}>
        <AppText variant="title" style={styles.flex}>
          {title}
        </AppText>
        {rating ? (
          <View style={[styles.header, { gap: theme.spacing.xs }]}>
            <AppText variant="caption" color={RATING_COLOR[rating]}>
              {s.home.rating[rating]}
            </AppText>
            <Icon
              name={rating === 'poor' ? 'info' : 'check'}
              color={theme.colors[RATING_COLOR[rating]]}
              size={22}
            />
          </View>
        ) : null}
      </View>
      <View style={{ gap: theme.spacing.xs }}>
        {factors.map(factor => (
          <View
            key={factor.label}
            accessible
            accessibilityLabel={`${factor.label}: ${factor.value}`}
            style={[styles.factor, { gap: theme.spacing.md }]}
          >
            <AppText variant="body" color="textSecondary">
              {factor.label}
            </AppText>
            <AppText
              variant="body"
              color={factor.color ?? 'textPrimary'}
              align="right"
              style={styles.flex}
            >
              {factor.value}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  factor: {
    alignItems: 'baseline',
    flexDirection: 'row',
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
