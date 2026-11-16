import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { useTheme, type ThemeColors } from '../../../app/theme';
import { AppText, Badge, Button, Card, type BadgeTone } from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import type {
  SecurityFinding,
  SecurityScore,
  SecuritySeverity,
} from '../../../domain/algorithms/security';
import {
  formatDateTime,
  useLanguage,
  useStrings,
  type Language,
  type Strings,
} from '../../../i18n';
import { ErrorNotice, FormCard, ToolFrame } from '../../network-tools/components/ToolFrame';
import { useToolTask } from '../../network-tools/hooks/useToolTask';
import { runSecurityCheck, type SecurityCheckResult } from '../services/securityCheck';

const TONE: Record<SecuritySeverity, BadgeTone> = {
  fail: 'danger',
  warn: 'warning',
  info: 'accent',
  pass: 'success',
  skip: 'neutral',
};
const SCORE_COLOR: Record<SecurityScore, keyof ThemeColors> = {
  good: 'success',
  fair: 'warning',
  risky: 'danger',
};

type FindingText = {
  pass?: (values: SecurityFinding['values']) => string;
  warn?: (values: SecurityFinding['values']) => string;
  fail?: (values: SecurityFinding['values']) => string;
  info?: (values: SecurityFinding['values']) => string;
  skip?: (values: SecurityFinding['values']) => string;
  advicePass?: string;
  adviceBad?: string;
  adviceInfo?: string;
  adviceSkip?: string;
};

/** Title and advice of a finding in the current language. */
export function securityText(
  finding: SecurityFinding,
  s: Strings,
): { title: string; advice: string } {
  const text = s.securityCheck.findings[finding.id] as FindingText;
  const title = (text[finding.severity] ?? text.warn ?? text.fail ?? text.info ?? text.pass)?.(
    finding.values,
  );
  const advice =
    finding.severity === 'pass'
      ? text.advicePass
      : finding.severity === 'skip'
      ? text.adviceSkip
      : finding.severity === 'info'
      ? text.adviceInfo ?? text.adviceBad
      : text.adviceBad;
  return { title: title ?? finding.id, advice: advice ?? '' };
}

export function formatSecurityReport(
  result: SecurityCheckResult,
  s: Strings,
  language: Language,
): string {
  const t = s.securityCheck;
  return [
    t.reportTitle,
    `${formatDateTime(result.createdAt, language)}${result.ssid ? ` · ${result.ssid}` : ''}`,
    `${t.score[result.score].title}`,
    '',
    ...result.findings.flatMap(finding => {
      const text = securityText(finding, s);
      return [
        `[${t.severity[finding.severity]}] ${text.title}`,
        ...finding.items.map(item => `    ${item}`),
        text.advice ? `  ${text.advice}` : '',
      ].filter(Boolean);
    }),
  ].join('\n');
}

export function SecurityCheckScreen() {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const navigation = useNavigation();
  const t = s.securityCheck;
  const { running, result, error, run } = useToolTask<SecurityCheckResult>();

  const risks = result?.findings.filter(finding => finding.severity === 'fail').length ?? 0;
  const checks = result?.findings.filter(finding => finding.severity === 'warn').length ?? 0;

  return (
    <ToolFrame toolId="security-check">
      <FormCard>
        <AppText variant="caption" color="textSecondary">
          {t.intro}
        </AppText>
        <Button
          testID="security-run"
          label={running ? t.running : t.run}
          onPress={() => run(runSecurityCheck)}
          busy={running}
          block
        />
      </FormCard>

      {error ? (
        error.message === 'not-local' ? (
          <Card>
            <AppText testID="security-not-local" color="textSecondary">
              {t.notLocal}
            </AppText>
          </Card>
        ) : (
          <ErrorNotice error={error} />
        )
      ) : null}

      {result ? (
        <>
          <Card testID="security-score">
            <View style={[styles.row, { gap: theme.spacing.md }]}>
              <View
                style={[
                  styles.scoreIcon,
                  {
                    backgroundColor: theme.colors.surfaceRaised,
                    borderColor: theme.colors[SCORE_COLOR[result.score]],
                    borderRadius: theme.radius.lg,
                  },
                ]}
              >
                <Icon name="shield" color={theme.colors[SCORE_COLOR[result.score]]} size={30} />
              </View>
              <View style={[styles.flex, { gap: 2 }]}>
                <AppText variant="title" color={SCORE_COLOR[result.score]}>
                  {t.score[result.score].title}
                </AppText>
                <AppText variant="caption" color="textSecondary">
                  {t.score[result.score].body}
                </AppText>
                {risks + checks > 0 ? (
                  <AppText variant="caption" color="textSecondary">
                    {t.counts(risks, checks)}
                  </AppText>
                ) : null}
              </View>
            </View>
          </Card>

          <Card padded={false}>
            {result.findings.map((finding, index) => {
              const text = securityText(finding, s);
              return (
                <View
                  key={finding.id}
                  testID={`security-${finding.id}`}
                  accessible
                  accessibilityLabel={`${t.severity[finding.severity]}: ${text.title}. ${
                    text.advice
                  }`}
                  style={[
                    styles.finding,
                    {
                      padding: theme.spacing.lg,
                      gap: theme.spacing.xs,
                      borderBottomColor: theme.colors.border,
                      borderBottomWidth:
                        index < result.findings.length - 1 ? StyleSheet.hairlineWidth : 0,
                    },
                  ]}
                >
                  <View style={[styles.row, { gap: theme.spacing.sm }]}>
                    <Badge label={t.severity[finding.severity]} tone={TONE[finding.severity]} />
                    <AppText variant="heading" style={styles.flex}>
                      {text.title}
                    </AppText>
                  </View>
                  {finding.items.map(item => (
                    <AppText key={item} variant="mono" color="textPrimary" style={styles.item}>
                      {item}
                    </AppText>
                  ))}
                  {text.advice ? (
                    <AppText variant="caption" color="textSecondary">
                      {text.advice}
                    </AppText>
                  ) : null}
                  {finding.id === 'devices-telnet' && finding.severity === 'skip' ? (
                    <Button
                      testID="security-scan-first"
                      label={t.scanFirst}
                      variant="secondary"
                      onPress={() =>
                        navigation.navigate('Main', {
                          screen: 'Devices',
                          params: { mode: 'network' },
                        })
                      }
                    />
                  ) : null}
                </View>
              );
            })}
          </Card>

          <Button
            testID="security-share"
            label={t.share}
            variant="secondary"
            onPress={() => Share.share({ message: formatSecurityReport(result, s, language) })}
          />
        </>
      ) : null}
    </ToolFrame>
  );
}

const styles = StyleSheet.create({
  finding: {
    flexDirection: 'column',
  },
  flex: {
    flex: 1,
  },
  item: {
    fontSize: 12,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  scoreIcon: {
    alignItems: 'center',
    borderWidth: 2,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
});
