import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '../../../app/theme';
import { AppText, Button } from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import { formatMbps } from '../../../domain/algorithms/speed';
import { formatDateTime, useLanguage, useStrings } from '../../../i18n';
import type { SpeedResult } from '../../../stores/speedTestStore';
import { formatMs } from '../../network-tools/components/ToolFrame';

export interface SpeedHeroCardProps {
  result: SpeedResult | null;
  onRun: () => void;
}

/** Large card with the latest speed-test result and a shortcut to run a new test. */
export function SpeedHeroCard({ result, onRun }: SpeedHeroCardProps) {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const t = s.home;
  const dark = theme.scheme === 'dark';

  return (
    <Pressable
      testID="home-speed"
      accessibilityRole="button"
      accessibilityLabel={
        result
          ? `${t.speed}: ${t.download} ${formatMbps(result.downloadMbps)} ${t.mbps}, ${
              t.upload
            } ${formatMbps(result.uploadMbps)} ${t.mbps}, ${t.ping} ${formatMs(
              result.idleLatencyMs,
              s,
            )}`
          : t.runSpeed
      }
      onPress={onRun}
      style={[styles.card, { borderRadius: theme.radius.lg, borderColor: theme.colors.border }]}
    >
      <Svg style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 100 100">
        <Defs>
          <LinearGradient id="speedHero" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.colors.accent} stopOpacity={dark ? 0.32 : 0.16} />
            <Stop offset="1" stopColor={theme.colors.surface} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={theme.colors.surface} />
        <Rect x="0" y="0" width="100" height="100" fill="url(#speedHero)" />
      </Svg>

      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
        <View style={[styles.row, { gap: theme.spacing.sm }]}>
          <Icon name="gauge" color={theme.colors.accent} size={20} />
          <AppText variant="overline" color="textSecondary" style={styles.flex}>
            {t.speed}
          </AppText>
          {result ? (
            <AppText variant="caption" color="textMuted">
              {t.lastTest(formatDateTime(result.finishedAt, language))}
            </AppText>
          ) : null}
        </View>

        {result ? (
          <View style={[styles.row, { gap: theme.spacing.lg }]}>
            <View style={styles.flex}>
              <View style={[styles.row, { gap: theme.spacing.xs }]}>
                <Icon name="arrowDown" color={theme.colors.accent} size={16} />
                <AppText variant="caption" color="textSecondary">
                  {t.download}
                </AppText>
              </View>
              <AppText variant="hero" testID="home-download">
                {formatMbps(result.downloadMbps)}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {t.mbps}
              </AppText>
            </View>
            <View style={styles.flex}>
              <View style={[styles.row, { gap: theme.spacing.xs }]}>
                <Icon name="arrowUp" color={theme.colors.info} size={16} />
                <AppText variant="caption" color="textSecondary">
                  {t.upload}
                </AppText>
              </View>
              <AppText variant="hero" testID="home-upload">
                {formatMbps(result.uploadMbps)}
              </AppText>
              <AppText variant="caption" color="textMuted">
                {t.mbps}
              </AppText>
            </View>
          </View>
        ) : (
          <AppText variant="body" color="textSecondary">
            {t.noSpeed}
          </AppText>
        )}

        <View style={[styles.row, { gap: theme.spacing.md }]}>
          {result ? (
            <AppText variant="mono" color="textSecondary" style={styles.flex}>
              {`${t.ping} ${formatMs(result.idleLatencyMs, s)}`}
            </AppText>
          ) : (
            <View style={styles.flex} />
          )}
          <Button label={t.runSpeed} onPress={onRun} testID="home-run-speed" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  flex: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
