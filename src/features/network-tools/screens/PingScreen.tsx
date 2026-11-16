import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
import { latencyLevel, pingStats } from '../../../domain/algorithms/ping';
import type { AddressFamily } from '../../../domain/models/netTools';
import { useStrings } from '../../../i18n';
import type { ToolScreenProps } from './ToolHostScreen';
import { ErrorNotice, FormCard, ToolFrame, formatMs } from '../components/ToolFrame';
import { usePing } from '../hooks/usePing';

const COUNTS = ['10', '50', '0'] as const;
type CountOption = (typeof COUNTS)[number];

export function PingScreen({ initialHost }: ToolScreenProps) {
  const theme = useTheme();
  const s = useStrings();
  const t = s.netTools;
  const [host, setHost] = useState(initialHost ?? '1.1.1.1');
  const [family, setFamily] = useState<AddressFamily>('any');
  const [count, setCount] = useState<CountOption>('10');
  const [inputError, setInputError] = useState<string | null>(null);
  const { running, samples, lastProbe, error, start, stop } = usePing();
  const stats = pingStats(samples);

  const onStart = () => {
    const value = host.trim();
    if (value === '') {
      setInputError(t.invalidHost);
      return;
    }
    setInputError(null);
    start(value, family, Number(count));
  };

  const levelColor = {
    good: 'success',
    fair: 'warning',
    poor: 'danger',
    none: 'textMuted',
  } as const;

  return (
    <ToolFrame toolId="ping">
      <FormCard>
        <TextField
          testID="ping-host"
          label={t.host}
          value={host}
          onChangeText={setHost}
          placeholder={t.hostPlaceholder}
          keyboardType="url"
          onSubmitEditing={onStart}
          error={inputError}
          editable={!running}
        />
        <SegmentedControl
          testID="ping-family"
          accessibilityLabel={t.family}
          options={(['any', 'ipv4', 'ipv6'] as const).map(value => ({
            value,
            label: t.families[value],
          }))}
          value={family}
          onChange={setFamily}
        />
        <SegmentedControl
          testID="ping-count"
          accessibilityLabel={t.ping.count}
          options={COUNTS.map(value => ({ value, label: t.ping.counts[value] }))}
          value={count}
          onChange={setCount}
        />
        {running ? (
          <Button testID="ping-stop" label={t.stop} variant="secondary" onPress={stop} />
        ) : (
          <Button testID="ping-start" label={t.start} onPress={onStart} />
        )}
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      {lastProbe?.method === 'tcp' ? (
        <Card>
          <AppText variant="caption" color="warning">
            {t.ping.tcpFallback}
          </AppText>
        </Card>
      ) : null}

      {samples.length > 0 ? (
        <>
          <SectionHeader title={t.ping.stats} />
          <Card>
            <InfoRow label={t.address} value={lastProbe?.address ?? '—'} />
            <InfoRow
              testID="ping-sent-received"
              label={`${t.ping.sent} / ${t.ping.received}`}
              value={`${stats.sent} / ${stats.received}`}
            />
            <InfoRow testID="ping-loss" label={t.ping.loss} value={`${stats.lossPercent}%`} />
            <InfoRow
              label={`${t.ping.min} / ${t.ping.avg} / ${t.ping.max}`}
              value={`${formatMs(stats.minMs, s)} / ${formatMs(stats.avgMs, s)} / ${formatMs(
                stats.maxMs,
                s,
              )}`}
            />
            <InfoRow label={t.ping.jitter} value={formatMs(stats.jitterMs, s)} />
          </Card>

          <SectionHeader title={t.ping.latency} />
          <Card>
            <LatencyChart
              values={samples.map(sample => (sample.status === 'reply' ? sample.rttMs : null))}
              accessibilityLabel={t.ping.chartLabel(
                Math.min(samples.length, 60),
                formatMs(stats.avgMs, s),
              )}
            />
          </Card>

          <SectionHeader title={t.ping.replies} />
          <Card padded={false}>
            {samples
              .slice(-20)
              .reverse()
              .map(sample => (
                <View
                  key={sample.seq}
                  testID={`ping-sample-${sample.seq}`}
                  style={[
                    styles.row,
                    {
                      paddingHorizontal: theme.spacing.lg,
                      paddingVertical: theme.spacing.sm,
                      borderBottomColor: theme.colors.border,
                    },
                  ]}
                >
                  <AppText variant="mono" color="textMuted">
                    {t.ping.seq(sample.seq)}
                  </AppText>
                  <AppText
                    variant="mono"
                    color={
                      sample.status === 'reply' ? levelColor[latencyLevel(sample.rttMs)] : 'danger'
                    }
                  >
                    {sample.status === 'reply'
                      ? `${formatMs(sample.rttMs, s)}${
                          sample.ttl !== null ? ` · ttl ${sample.ttl}` : ''
                        }`
                      : t.ping.status[sample.status]}
                  </AppText>
                </View>
              ))}
          </Card>
        </>
      ) : null}
    </ToolFrame>
  );
}

const styles = StyleSheet.create({
  row: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
