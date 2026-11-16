import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { AppText, Badge, Button, Card, type BadgeTone } from '../../../components/common';
import { useStrings, type Strings } from '../../../i18n';
import { FormCard, ToolFrame, formatMs } from '../components/ToolFrame';
import {
  CHECK_ORDER,
  runCheck,
  type CheckId,
  type CheckResult,
  type CheckState,
} from '../services/reachability';

const STATE_TONE: Record<CheckState, BadgeTone> = {
  pass: 'success',
  warn: 'warning',
  fail: 'danger',
  skip: 'neutral',
};

function detailText(result: CheckResult, s: Strings): string {
  const t = s.netTools.reachability;
  const detail = result.detail;
  switch (detail.kind) {
    case 'latency':
      return t.connected(detail.target, formatMs(detail.ms, s));
    case 'portal':
      return t.portal(detail.status);
    case 'no-portal':
      return t.noPortal;
    case 'no-gateway':
      return t.noGateway;
    case 'error':
      return t.unreachable(detail.message);
  }
}

export function ReachabilityScreen() {
  const theme = useTheme();
  const s = useStrings();
  const t = s.netTools.reachability;
  const [results, setResults] = useState<Partial<Record<CheckId, CheckResult>>>({});
  const [current, setCurrent] = useState<CheckId | null>(null);
  const [done, setDone] = useState(false);
  const runId = useRef(0);

  useEffect(
    () => () => {
      runId.current += 1;
    },
    [],
  );

  const runAll = useCallback(async () => {
    const id = ++runId.current;
    setResults({});
    setDone(false);
    for (const check of CHECK_ORDER) {
      setCurrent(check);
      const result = await runCheck(check);
      if (id !== runId.current) return;
      setResults(previous => ({ ...previous, [check]: result }));
    }
    setCurrent(null);
    setDone(true);
  }, []);

  const issues = Object.values(results).filter(
    result => result && (result.state === 'fail' || result.state === 'warn'),
  ).length;

  return (
    <ToolFrame toolId="reachability">
      <FormCard>
        <AppText variant="caption" color="textSecondary">
          {t.intro}
        </AppText>
        <Button testID="reachability-run" label={t.run} onPress={runAll} busy={current !== null} />
      </FormCard>

      <Card padded={false}>
        {CHECK_ORDER.map(check => {
          const result = results[check];
          return (
            <View
              key={check}
              testID={`check-${check}`}
              accessible
              accessibilityLabel={`${t.checks[check]}: ${
                result ? `${t.state[result.state]}, ${detailText(result, s)}` : '—'
              }`}
              style={[
                styles.row,
                {
                  gap: theme.spacing.md,
                  paddingHorizontal: theme.spacing.lg,
                  paddingVertical: theme.spacing.md,
                  borderBottomColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.body}>
                <AppText variant="heading">{t.checks[check]}</AppText>
                {result ? (
                  <AppText variant="caption" color="textSecondary" selectable>
                    {detailText(result, s)}
                  </AppText>
                ) : null}
              </View>
              {result ? (
                <Badge label={t.state[result.state]} tone={STATE_TONE[result.state]} />
              ) : current === check ? (
                <ActivityIndicator color={theme.colors.accent} />
              ) : null}
            </View>
          );
        })}
      </Card>

      {done ? (
        <AppText
          testID="reachability-summary"
          variant="body"
          color={issues === 0 ? 'success' : 'warning'}
        >
          {issues === 0 ? t.summaryOk : t.summaryIssues(issues)}
        </AppText>
      ) : null}
    </ToolFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    gap: 2,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
});
