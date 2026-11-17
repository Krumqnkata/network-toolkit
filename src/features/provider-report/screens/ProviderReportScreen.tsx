import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';

import { useTheme, type ThemeColors } from '../../../app/theme';
import {
  AppText,
  Button,
  Card,
  ChoiceChips,
  InfoRow,
  SectionHeader,
  TextField,
} from '../../../components/common';
import { speedResults } from '../../../database/repositories';
import { getSetting, setSetting } from '../../../database/storage';
import {
  THRESHOLD,
  buildProviderReport,
  reportCsv,
  type DayPart,
  type PlanSpeed,
  type ProviderReport,
  type ReportTest,
  type ReportVerdict,
} from '../../../domain/algorithms/providerReport';
import {
  formatDateTime,
  useLanguage,
  useStrings,
  type Language,
  type Strings,
} from '../../../i18n';
import { shareFile } from '../../../native/export';
import { getSpeedSchedule, setSpeedSchedule, type SpeedSchedule } from '../../../native/speedTest';
import { useHomeStore } from '../../../stores/homeStore';
import { logError, toAppError, type AppError } from '../../../utils/errors';
import { ErrorNotice, FormCard, ToolFrame } from '../../network-tools/components/ToolFrame';

const PLAN_KEYS = { down: 'report.planDown', up: 'report.planUp' } as const;
const VERDICT_COLOR: Record<ReportVerdict, keyof ThemeColors> = {
  good: 'success',
  fair: 'warning',
  poor: 'danger',
  'no-plan': 'textPrimary',
  'no-data': 'textPrimary',
};
const PERIODS = { d7: 7, d30: 30, d90: 90 } as const;
type PeriodKey = keyof typeof PERIODS;
const SCHEDULES: Record<'off' | 'h6' | 'h12' | 'h24', SpeedSchedule> = {
  off: 0,
  h6: 6,
  h12: 12,
  h24: 24,
};
type ScheduleKey = keyof typeof SCHEDULES;

const parseMbps = (text: string) => {
  const value = Number(text.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
};
const mbps = (value: number | null) => (value === null ? '—' : `${value} Mbps`);

export function formatProviderReport(
  report: ProviderReport,
  plan: PlanSpeed,
  provider: string | null,
  period: { from: number; to: number },
  s: Strings,
  language: Language,
): string {
  const t = s.providerReport;
  const verdict = t.verdict[report.verdict];
  const lines = [
    t.reportTitle,
    provider ? t.provider(provider) : null,
    t.reportPlan(plan.downloadMbps?.toString() ?? '—', plan.uploadMbps?.toString() ?? '—'),
    t.reportPeriod(formatDateTime(period.from, language), formatDateTime(period.to, language)),
    '',
    verdict.title,
    verdict.body(report.downloadPercent ?? 0),
    '',
    `${t.stats.download}: ${mbps(report.medianDownload)}${
      report.downloadPercent !== null ? ` (${t.ofPlan(report.downloadPercent)})` : ''
    }`,
    `${t.stats.upload}: ${mbps(report.medianUpload)}${
      report.uploadPercent !== null ? ` (${t.ofPlan(report.uploadPercent)})` : ''
    }`,
    `${t.stats.range}: ${mbps(report.minDownload)} – ${mbps(report.maxDownload)}`,
    `${t.stats.ping}: ${report.medianPing === null ? '—' : `${report.medianPing} ms`}`,
    report.reachedPercent !== null ? `${t.stats.reached}: ${report.reachedPercent}%` : null,
    `${t.stats.tests}: ${report.tests.length}`,
    report.slowestPart && report.slowdownPercent !== null
      ? t.slowest(t.dayParts[report.slowestPart], report.slowdownPercent)
      : null,
    report.excludedWeakWifi + report.excludedOther > 0
      ? t.excluded(report.excludedWeakWifi + report.excludedOther)
      : null,
    '',
    `${t.reportTests}:`,
    ...report.tests.map(
      test =>
        `${formatDateTime(test.at, language)} — ↓ ${mbps(test.downloadMbps)} ↑ ${mbps(
          test.uploadMbps,
        )}${test.scheduled ? ` (${t.auto})` : ''}`,
    ),
  ];
  return lines.filter(line => line !== null).join('\n');
}

/** Download per test as bars, with the plan and the 80% line. */
function ReportChart({
  tests,
  plan,
  width,
}: {
  tests: ReportTest[];
  plan: number | null;
  width: number;
}) {
  const theme = useTheme();
  const t = useStrings().providerReport;
  const height = 150;
  const shown = tests.slice(-60);
  const max = Math.max(plan ?? 0, ...shown.map(test => test.downloadMbps ?? 0)) * 1.1 || 1;
  const y = (value: number) => height - 16 - (value / max) * (height - 28);
  const step = width / Math.max(shown.length, 1);
  const colorOf = (value: number) =>
    !plan
      ? theme.colors.accent
      : value >= plan * THRESHOLD
      ? theme.colors.success
      : value >= plan * 0.5
      ? theme.colors.warning
      : theme.colors.danger;
  return (
    <Svg width={width} height={height} accessibilityLabel={t.chartLabel(shown.length)}>
      {shown.map((test, index) => {
        const value = test.downloadMbps ?? 0;
        return (
          <Rect
            key={test.at}
            x={index * step + step * 0.15}
            y={y(value)}
            width={Math.max(2, step * 0.7)}
            height={Math.max(1, height - 16 - y(value))}
            rx={2}
            fill={colorOf(value)}
            opacity={test.scheduled ? 0.75 : 1}
          />
        );
      })}
      {plan ? (
        <>
          <Line
            x1={0}
            x2={width}
            y1={y(plan)}
            y2={y(plan)}
            stroke={theme.colors.textSecondary}
            strokeWidth={1.5}
          />
          <Line
            x1={0}
            x2={width}
            y1={y(plan * THRESHOLD)}
            y2={y(plan * THRESHOLD)}
            stroke={theme.colors.textMuted}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <SvgText
            x={width - 4}
            y={y(plan) - 4}
            fontSize={10}
            fill={theme.colors.textSecondary}
            textAnchor="end"
            fontFamily="Inter"
          >
            {`${t.planLine} ${plan}`}
          </SvgText>
        </>
      ) : null}
      <Line
        x1={0}
        x2={width}
        y1={height - 16}
        y2={height - 16}
        stroke={theme.colors.border}
        strokeWidth={1}
      />
    </Svg>
  );
}

export function ProviderReportScreen() {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const navigation = useNavigation();
  const t = s.providerReport;
  const provider = useHomeStore(state => state.publicInfo?.provider ?? null);
  const [planDown, setPlanDown] = useState('');
  const [planUp, setPlanUp] = useState('');
  const [plan, setPlan] = useState<PlanSpeed>({ downloadMbps: null, uploadMbps: null });
  const [saved, setSaved] = useState(false);
  const [schedule, setSchedule] = useState<ScheduleKey>('off');
  const [period, setPeriod] = useState<PeriodKey>('d30');
  const [tests, setTests] = useState<ReportTest[]>([]);
  const [lastBytes, setLastBytes] = useState<number | null>(null);
  const [error, setError] = useState<AppError | null>(null);
  const [width, setWidth] = useState(0);

  const load = useCallback(async () => {
    try {
      const [down, up, hours, records] = await Promise.all([
        getSetting(PLAN_KEYS.down),
        getSetting(PLAN_KEYS.up),
        getSpeedSchedule(),
        speedResults.list(200),
      ]);
      setPlanDown(down ?? '');
      setPlanUp(up ?? '');
      setPlan({ downloadMbps: parseMbps(down ?? ''), uploadMbps: parseMbps(up ?? '') });
      const key = (Object.keys(SCHEDULES) as ScheduleKey[]).find(name => SCHEDULES[name] === hours);
      setSchedule(key ?? 'off');
      setTests(
        records.map(({ data }) => ({
          at: data.finishedAt,
          downloadMbps: data.downloadMbps,
          uploadMbps: data.uploadMbps,
          pingMs: data.idleLatencyMs,
          scheduled: data.scheduled === true,
          transport: data.transport ?? null,
          rssi: data.rssi ?? null,
        })),
      );
      const last = records[0]?.data;
      setLastBytes(last ? last.bytesDownloaded + last.bytesUploaded : null);
    } catch (caught) {
      logError('provider-report', caught);
      setError(toAppError(caught));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = Date.now();
  const report = useMemo(
    () => buildProviderReport(tests, plan, { now, days: PERIODS[period] }),
    // `now` changes every render; the report only needs refreshing with its inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tests, plan, period],
  );

  const savePlan = async () => {
    const next = { downloadMbps: parseMbps(planDown), uploadMbps: parseMbps(planUp) };
    await Promise.all([
      setSetting(PLAN_KEYS.down, next.downloadMbps?.toString() ?? null),
      setSetting(PLAN_KEYS.up, next.uploadMbps?.toString() ?? null),
    ]);
    setPlan(next);
    setSaved(true);
  };

  const changeSchedule = async (key: ScheduleKey) => {
    setSchedule(key);
    try {
      await setSpeedSchedule(SCHEDULES[key]);
    } catch (caught) {
      logError('provider-report', caught);
      setError(toAppError(caught));
    }
  };

  // Scheduled tests are about half as long as a manual one.
  const perTestMb = lastBytes ? Math.max(1, Math.round(lastBytes / 2 / 1_000_000)) : null;
  const verdict = t.verdict[report.verdict];
  const range = { from: now - PERIODS[period] * 86_400_000, to: now };
  const share = (kind: 'txt' | 'csv') => {
    const base = `speed-report-${new Date(now).toISOString().slice(0, 10)}`;
    const contents =
      kind === 'csv'
        ? reportCsv(report.tests, plan)
        : formatProviderReport(report, plan, provider, range, s, language);
    if (kind === 'txt') {
      Share.share({ message: contents }).catch(caught => logError('provider-report', caught));
      return;
    }
    shareFile(`${base}.csv`, contents, { title: t.reportTitle }).catch(caught =>
      setError(toAppError(caught)),
    );
  };

  return (
    <ToolFrame toolId="provider-report">
      <AppText variant="caption" color="textSecondary">
        {t.intro}
      </AppText>

      <SectionHeader title={t.plan} />
      <FormCard>
        {provider ? (
          <AppText variant="caption" color="textSecondary">
            {t.provider(provider)}
          </AppText>
        ) : null}
        <TextField
          testID="report-plan-down"
          label={t.planDown}
          value={planDown}
          keyboardType="decimal-pad"
          onChangeText={value => {
            setPlanDown(value);
            setSaved(false);
          }}
        />
        <TextField
          testID="report-plan-up"
          label={t.planUp}
          value={planUp}
          keyboardType="decimal-pad"
          onChangeText={value => {
            setPlanUp(value);
            setSaved(false);
          }}
        />
        <AppText variant="caption" color="textMuted">
          {saved ? t.planSaved : t.planHint}
        </AppText>
        <Button
          testID="report-save-plan"
          label={t.savePlan}
          variant="secondary"
          onPress={savePlan}
        />
      </FormCard>

      <SectionHeader title={t.schedule} />
      <FormCard>
        <ChoiceChips
          testID="report-schedule"
          accessibilityLabel={t.schedule}
          options={(Object.keys(SCHEDULES) as ScheduleKey[]).map(key => ({
            value: key,
            label: t.scheduleOptions[key],
          }))}
          value={schedule}
          onChange={changeSchedule}
        />
        <AppText variant="caption" color="textSecondary">
          {perTestMb ? t.scheduleHint(perTestMb) : t.scheduleHintUnknown}
        </AppText>
        <Button
          testID="report-test-now"
          label={t.testNow}
          variant="secondary"
          onPress={() =>
            navigation.navigate('Main', { screen: 'SpeedTest', params: { autoStart: Date.now() } })
          }
        />
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      <SectionHeader title={t.period} />
      <ChoiceChips
        testID="report-period"
        accessibilityLabel={t.period}
        options={(Object.keys(PERIODS) as PeriodKey[]).map(key => ({
          value: key,
          label: t.periods[key],
        }))}
        value={period}
        onChange={setPeriod}
      />

      <Card testID="report-verdict">
        <AppText variant="title" color={VERDICT_COLOR[report.verdict]}>
          {verdict.title}
        </AppText>
        <AppText variant="body" color="textSecondary">
          {verdict.body(report.downloadPercent ?? 0)}
        </AppText>
      </Card>

      {report.tests.length ? (
        <>
          <Card testID="report-stats">
            <InfoRow
              label={t.stats.download}
              value={`${mbps(report.medianDownload)}${
                report.downloadPercent !== null ? ` · ${t.ofPlan(report.downloadPercent)}` : ''
              }`}
              mono={false}
            />
            <InfoRow
              label={t.stats.upload}
              value={`${mbps(report.medianUpload)}${
                report.uploadPercent !== null ? ` · ${t.ofPlan(report.uploadPercent)}` : ''
              }`}
              mono={false}
            />
            <InfoRow
              label={t.stats.range}
              value={`${mbps(report.minDownload)} – ${mbps(report.maxDownload)}`}
              mono={false}
            />
            <InfoRow
              label={t.stats.ping}
              value={report.medianPing === null ? '—' : `${report.medianPing} ms`}
              mono={false}
            />
            {report.reachedPercent !== null ? (
              <InfoRow label={t.stats.reached} value={`${report.reachedPercent}%`} mono={false} />
            ) : null}
            <InfoRow label={t.stats.tests} value={String(report.tests.length)} mono={false} />
          </Card>

          <SectionHeader title={t.chart} />
          <Card>
            <View onLayout={event => setWidth(Math.floor(event.nativeEvent.layout.width))}>
              {width > 0 ? (
                <ReportChart tests={report.tests} plan={plan.downloadMbps} width={width} />
              ) : null}
            </View>
          </Card>

          <SectionHeader title={t.byTime} />
          <Card testID="report-by-time">
            {(Object.keys(report.byDayPart) as DayPart[]).map(part => (
              <InfoRow
                key={part}
                label={t.dayParts[part]}
                value={
                  report.byDayPart[part].medianDownload === null
                    ? '—'
                    : `${mbps(report.byDayPart[part].medianDownload)} · ${
                        report.byDayPart[part].tests
                      }×`
                }
                mono={false}
              />
            ))}
            {report.slowestPart && report.slowdownPercent !== null ? (
              <AppText
                testID="report-slowest"
                variant="caption"
                color="warning"
                style={{ marginTop: theme.spacing.sm }}
              >
                {t.slowest(t.dayParts[report.slowestPart], report.slowdownPercent)}
              </AppText>
            ) : null}
          </Card>

          {report.excludedWeakWifi + report.excludedOther > 0 ? (
            <AppText testID="report-excluded" variant="caption" color="textMuted">
              {t.excluded(report.excludedWeakWifi + report.excludedOther)}
            </AppText>
          ) : null}

          <View style={[styles.row, { gap: theme.spacing.sm }]}>
            <Button
              testID="report-share-text"
              label={t.shareText}
              variant="secondary"
              onPress={() => share('txt')}
            />
            <Button
              testID="report-share-csv"
              label={t.shareCsv}
              variant="secondary"
              onPress={() => share('csv')}
            />
          </View>
        </>
      ) : null}
    </ToolFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
