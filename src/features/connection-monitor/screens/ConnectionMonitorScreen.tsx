import React, { useEffect, useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { LatencyChart } from '../../../components/charts/LatencyChart';
import {
  AppText,
  Button,
  Card,
  InfoRow,
  SectionHeader,
  SegmentedControl,
  TextField,
} from '../../../components/common';
import {
  formatDuration,
  outageDurationMs,
  statsOf,
  uptimePercent,
} from '../../../domain/algorithms/monitor';
import { isIPv4 } from '../../../domain/algorithms/ip';
import { formatDateTime, formatTime, useLanguage, useStrings } from '../../../i18n';
import { getNetworkSnapshot } from '../../../native/network';
import { useMonitorStore } from '../../../stores/monitorStore';
import { logError } from '../../../utils/errors';
import {
  ErrorNotice,
  FormCard,
  ToolFrame,
  formatMs,
} from '../../network-tools/components/ToolFrame';
import { formatMonitorSession } from '../../reports/formatReport';
import { startMonitor, stopMonitor } from '../services/monitor';

type TargetOption = 'internet' | 'gateway' | 'custom';

const INTERNET_TARGET = '1.1.1.1';

export function ConnectionMonitorScreen() {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const t = s.monitor;
  const {
    running,
    target,
    startedAt,
    samples,
    accumulator,
    error,
    history,
    refreshHistory,
    removeSession,
  } = useMonitorStore();
  const [option, setOption] = useState<TargetOption>('internet');
  const [custom, setCustom] = useState('');
  const [inputError, setInputError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    refreshHistory();
  }, [refreshHistory]);

  // Re-render the duration once per second while monitoring.
  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  const onStart = async () => {
    setInputError(null);
    let host = INTERNET_TARGET;
    if (option === 'custom') {
      host = custom.trim();
      if (host === '') {
        setInputError(s.netTools.invalidHost);
        return;
      }
    } else if (option === 'gateway') {
      try {
        const gateway = (await getNetworkSnapshot()).gateways.find(isIPv4);
        if (!gateway) {
          setInputError(t.noGateway);
          return;
        }
        host = gateway;
      } catch (caught) {
        logError('monitor', caught);
        setInputError(t.noGateway);
        return;
      }
    }
    startMonitor(host);
  };

  const stats = statsOf(accumulator);
  const last = samples[samples.length - 1];
  const end = running ? now : samples[samples.length - 1]?.t ?? now;
  const hasSession = startedAt !== null && samples.length > 0;

  return (
    <ToolFrame toolId="connection-monitor">
      <FormCard>
        <AppText variant="caption" color="textSecondary">
          {t.intro}
        </AppText>
        <SegmentedControl
          testID="monitor-target"
          accessibilityLabel={t.target}
          options={(['internet', 'gateway', 'custom'] as const).map(value => ({
            value,
            label: t.targets[value],
          }))}
          value={option}
          onChange={setOption}
        />
        {option === 'custom' ? (
          <TextField
            testID="monitor-host"
            label={s.netTools.host}
            value={custom}
            onChangeText={setCustom}
            placeholder={s.netTools.hostPlaceholder}
            keyboardType="url"
            editable={!running}
          />
        ) : null}
        {inputError ? (
          <AppText variant="caption" color="danger">
            {inputError}
          </AppText>
        ) : null}
        {running ? (
          <Button testID="monitor-stop" label={t.stop} variant="secondary" onPress={stopMonitor} />
        ) : (
          <Button testID="monitor-start" label={t.start} onPress={onStart} />
        )}
        <AppText variant="caption" color="textMuted">
          {t.foreground}
        </AppText>
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      {hasSession && startedAt !== null ? (
        <>
          <SectionHeader title={running ? `${t.live} · ${target}` : target ?? t.live} />
          <Card>
            <InfoRow
              testID="monitor-current"
              label={t.current}
              value={
                last
                  ? last.rtt === null
                    ? s.netTools.ping.status.timeout
                    : formatMs(last.rtt, s)
                  : '—'
              }
            />
            <InfoRow label={t.duration} value={formatDuration(end - startedAt)} />
            <InfoRow
              testID="monitor-loss"
              label={s.netTools.ping.loss}
              value={`${stats.lossPercent}% (${stats.sent - stats.received}/${stats.sent})`}
            />
            <InfoRow
              label={`${s.netTools.ping.min} / ${s.netTools.ping.avg} / ${s.netTools.ping.max}`}
              value={`${formatMs(stats.minMs, s)} / ${formatMs(stats.avgMs, s)} / ${formatMs(
                stats.maxMs,
                s,
              )}`}
            />
            <InfoRow label={s.netTools.ping.jitter} value={formatMs(stats.jitterMs, s)} />
            <InfoRow
              testID="monitor-uptime"
              label={t.uptime}
              value={`${uptimePercent(accumulator.outages, startedAt, end)}%`}
            />
          </Card>
          <Card>
            <LatencyChart
              values={samples.map(sample => sample.rtt)}
              accessibilityLabel={t.chartLabel(Math.min(samples.length, 90))}
              window={90}
            />
          </Card>

          <SectionHeader title={`${t.outages} (${accumulator.outages.length})`} />
          <Card>
            {accumulator.outages.length === 0 ? (
              <AppText variant="body" color="textSecondary">
                {t.noOutages}
              </AppText>
            ) : (
              accumulator.outages.map(outage => (
                <InfoRow
                  key={outage.start}
                  label={formatTime(outage.start, language)}
                  value={
                    outage.end === null
                      ? `${formatDuration(outageDurationMs(outage, now))} · ${t.ongoing}`
                      : formatDuration(outageDurationMs(outage, now))
                  }
                />
              ))
            )}
          </Card>
        </>
      ) : null}

      {history.filter(record => record.data.endedAt !== null).length > 0 ? (
        <>
          <SectionHeader title={t.history} />
          <Card padded={false}>
            {history
              .filter(record => record.data.endedAt !== null)
              .map(({ id, data: session }, index, list) => {
                const loss =
                  session.sent === 0 ? 0 : ((session.sent - session.received) / session.sent) * 100;
                return (
                  <View
                    key={id}
                    testID={`monitor-session-${id}`}
                    style={[
                      styles.session,
                      {
                        padding: theme.spacing.lg,
                        gap: theme.spacing.xs,
                        borderBottomColor: theme.colors.border,
                        borderBottomWidth: index < list.length - 1 ? StyleSheet.hairlineWidth : 0,
                      },
                    ]}
                  >
                    <AppText variant="heading">
                      {`${session.target} · ${formatDateTime(session.startedAt, language)}`}
                    </AppText>
                    <AppText variant="caption" color="textSecondary">
                      {t.sessionRow(
                        formatDuration((session.endedAt ?? session.startedAt) - session.startedAt),
                        `${loss.toFixed(1)}%`,
                        session.outages.length,
                      )}
                    </AppText>
                    <View style={[styles.actions, { gap: theme.spacing.sm }]}>
                      <Button
                        label={t.share}
                        variant="secondary"
                        onPress={() =>
                          Share.share({ message: formatMonitorSession(session, s, language) })
                        }
                      />
                      <Button
                        label={t.delete}
                        variant="secondary"
                        onPress={() => removeSession(id)}
                      />
                    </View>
                  </View>
                );
              })}
          </Card>
        </>
      ) : null}
    </ToolFrame>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    marginTop: 4,
  },
  session: {
    flexDirection: 'column',
  },
});
