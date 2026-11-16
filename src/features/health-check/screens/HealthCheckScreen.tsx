import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import {
  AppText,
  Badge,
  Button,
  Card,
  InfoRow,
  SectionHeader,
  type BadgeTone,
} from '../../../components/common';
import type { Severity } from '../../../domain/algorithms/diagnosis';
import type { StoredRecord } from '../../../database/storage';
import { formatDateTime, useLanguage, useStrings } from '../../../i18n';
import { logError } from '../../../utils/errors';
import { ErrorNotice, FormCard, ToolFrame } from '../../network-tools/components/ToolFrame';
import { useToolTask } from '../../network-tools/hooks/useToolTask';
import { findingText, formatHealthReport } from '../../reports/formatReport';
import { SegmentChain } from '../components/SegmentChain';
import { healthReports, runHealthCheck, type HealthReport } from '../services/healthCheck';

const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  problem: 'danger',
  warning: 'warning',
  info: 'neutral',
  ok: 'success',
};

export function HealthCheckScreen() {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const t = s.health;
  const { running, result, error, run } = useToolTask<HealthReport>();
  const [history, setHistory] = useState<StoredRecord<HealthReport>[]>([]);

  const loadHistory = () =>
    healthReports
      .list(10)
      .then(records => setHistory(records as StoredRecord<HealthReport>[]))
      .catch(caught => logError('health', caught));

  useEffect(() => {
    loadHistory();
  }, []);

  const onRun = () =>
    run(async () => {
      const report = await runHealthCheck();
      // The report is saved in the background; refresh the list afterwards.
      setTimeout(loadHistory, 500);
      return report;
    });

  return (
    <ToolFrame toolId="health-check">
      <FormCard>
        <AppText variant="caption" color="textSecondary">
          {t.intro}
        </AppText>
        <Button
          testID="health-run"
          label={running ? t.running : t.run}
          onPress={onRun}
          busy={running}
        />
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      {running ? (
        <AppText variant="caption" color="textSecondary" testID="locator-measuring">
          {t.locator.measuring}
        </AppText>
      ) : null}

      {result?.location ? (
        <>
          <SectionHeader title={t.locator.title} />
          <SegmentChain location={result.location} transport={result.transport} />
        </>
      ) : null}

      {result ? (
        <>
          <SectionHeader title={t.findings} />
          <Card padded={false}>
            {result.findings.map((finding, index) => {
              const text = findingText(finding, s);
              return (
                <View
                  key={finding.id}
                  testID={`finding-${finding.id}`}
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
                    <Badge
                      label={t.severity[finding.severity]}
                      tone={SEVERITY_TONE[finding.severity]}
                    />
                    <AppText variant="heading" style={styles.flex}>
                      {text.title}
                    </AppText>
                  </View>
                  <AppText variant="caption" color="textSecondary">
                    {text.advice}
                  </AppText>
                </View>
              );
            })}
          </Card>
          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <Button
              testID="health-share"
              label={t.share}
              variant="secondary"
              onPress={() => Share.share({ message: formatHealthReport(result, s, language) })}
            />
            <Button
              testID="health-share-json"
              label={t.shareJson}
              variant="secondary"
              onPress={() => Share.share({ message: JSON.stringify(result, null, 2) })}
            />
          </View>
        </>
      ) : null}

      {history.length > 0 ? (
        <>
          <SectionHeader title={t.history} />
          <Card>
            {history.map(({ id, data }) => (
              <InfoRow
                key={id}
                label={formatDateTime(data.createdAt, language)}
                value={t.reportRow(
                  data.findings.filter(finding => finding.severity === 'problem').length,
                  data.findings.filter(finding => finding.severity === 'warning').length,
                )}
                mono={false}
              />
            ))}
          </Card>
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
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
