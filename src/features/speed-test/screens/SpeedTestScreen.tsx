import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { SpeedGauge } from '../../../components/charts/SpeedGauge';
import {
  AppText,
  Badge,
  Button,
  Card,
  InfoRow,
  ProgressBar,
  SectionHeader,
} from '../../../components/common';
import {
  bloatLevel,
  formatBytes,
  formatMbps,
  latencyIncrease,
} from '../../../domain/algorithms/speed';
import { formatDateTime, useLanguage, useStrings } from '../../../i18n';
import { getNetworkSnapshot } from '../../../native/network';
import { useSpeedTestStore } from '../../../stores/speedTestStore';
import { logError } from '../../../utils/errors';
import {
  ErrorNotice,
  FormCard,
  ToolFrame,
  formatMs,
} from '../../network-tools/components/ToolFrame';
import { useSpeedTest } from '../hooks/useSpeedTest';

const BLOAT_TONE = { low: 'success', moderate: 'warning', high: 'danger' } as const;

function Metric({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={styles.metric}
    >
      <AppText variant="overline" color="textMuted">
        {label}
      </AppText>
      <AppText variant="title" style={{ marginTop: theme.spacing.xxs }}>
        {value}
      </AppText>
    </View>
  );
}

export function SpeedTestScreen() {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const t = s.speed;
  const { status, running, error, start, cancel } = useSpeedTest();
  const results = useSpeedTestStore(state => state.results);
  const loadResults = useSpeedTestStore(state => state.load);
  const clearResults = useSpeedTestStore(state => state.clear);

  useEffect(() => {
    loadResults();
  }, [loadResults]);
  const [confirmMetered, setConfirmMetered] = useState(false);

  const onStart = async () => {
    try {
      const snapshot = await getNetworkSnapshot();
      if (snapshot.isMetered) {
        setConfirmMetered(true);
        return;
      }
    } catch (caught) {
      logError('speed-test', caught);
    }
    start();
  };

  const phase = status?.phase ?? 'idle';
  const shownMbps = running
    ? status?.currentMbps ?? null
    : phase === 'done'
    ? status?.downloadMbps ?? null
    : null;
  const caption =
    phase === 'done' ? t.download : phase === 'idle' ? t.phases.idle : t.phases[phase];
  const downloadIncrease = latencyIncrease(
    status?.idleLatencyMs ?? null,
    status?.downloadLatencyMs ?? null,
  );
  const uploadIncrease = latencyIncrease(
    status?.idleLatencyMs ?? null,
    status?.uploadLatencyMs ?? null,
  );
  const worstIncrease =
    downloadIncrease === null && uploadIncrease === null
      ? null
      : Math.max(downloadIncrease ?? 0, uploadIncrease ?? 0);
  const bloat = phase === 'done' ? bloatLevel(worstIncrease) : null;
  const server = [status?.serverColo, status?.serverCity, status?.serverCountry]
    .filter(Boolean)
    .join(' · ');

  return (
    <ToolFrame toolId="speed-test">
      <FormCard>
        <AppText variant="caption" color="textSecondary">
          {t.intro}
        </AppText>
        {confirmMetered && !running ? (
          <View style={{ gap: theme.spacing.sm }}>
            <AppText variant="heading" color="warning">
              {t.meteredTitle}
            </AppText>
            <AppText variant="caption" color="textSecondary">
              {t.meteredBody}
            </AppText>
            <Button
              testID="speed-run-anyway"
              label={t.runAnyway}
              onPress={() => {
                setConfirmMetered(false);
                start();
              }}
            />
          </View>
        ) : running ? (
          <Button testID="speed-stop" label={t.stop} variant="secondary" onPress={cancel} />
        ) : (
          <Button
            testID="speed-start"
            label={phase === 'done' ? t.again : t.start}
            onPress={onStart}
          />
        )}
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      <Card>
        <SpeedGauge
          mbps={shownMbps}
          valueText={formatMbps(shownMbps)}
          unit={t.mbps}
          caption={caption}
          accessibilityLabel={t.gaugeLabel(formatMbps(shownMbps), caption)}
        />
        {running && status ? (
          <ProgressBar value={status.progress} label={t.phases[status.phase]} />
        ) : null}
        {phase === 'error' && status?.error ? (
          <AppText testID="speed-error" variant="caption" color="danger" selectable>
            {`${t.phases.error}: ${status.error}`}
          </AppText>
        ) : null}
        {status && phase !== 'idle' ? (
          <View style={[styles.metrics, { marginTop: theme.spacing.lg, rowGap: theme.spacing.lg }]}>
            <Metric
              testID="speed-download"
              label={t.download}
              value={`${formatMbps(status.downloadMbps)} ${t.mbps}`}
            />
            <Metric
              testID="speed-upload"
              label={t.upload}
              value={`${formatMbps(status.uploadMbps)} ${t.mbps}`}
            />
            <Metric testID="speed-ping" label={t.ping} value={formatMs(status.idleLatencyMs, s)} />
            <Metric label={t.jitter} value={formatMs(status.jitterMs, s)} />
          </View>
        ) : null}
      </Card>

      {status && phase !== 'idle' ? (
        <>
          <SectionHeader title={t.loaded} />
          <Card>
            {bloat ? (
              <View style={{ marginBottom: theme.spacing.sm }}>
                <Badge label={t.bloat[bloat]} tone={BLOAT_TONE[bloat]} />
              </View>
            ) : null}
            <InfoRow
              label={t.duringDownload}
              value={
                status.downloadLatencyMs === null
                  ? '—'
                  : `${formatMs(status.downloadLatencyMs, s)}${
                      downloadIncrease !== null
                        ? ` (${t.increase(formatMs(downloadIncrease, s))})`
                        : ''
                    }`
              }
            />
            <InfoRow
              label={t.duringUpload}
              value={
                status.uploadLatencyMs === null
                  ? '—'
                  : `${formatMs(status.uploadLatencyMs, s)}${
                      uploadIncrease !== null ? ` (${t.increase(formatMs(uploadIncrease, s))})` : ''
                    }`
              }
            />
            <InfoRow
              testID="speed-loss"
              label={t.loss}
              value={
                status.packetLossPercent === null
                  ? t.lossUnavailable
                  : `${status.packetLossPercent}%`
              }
            />
            {server ? <InfoRow label={t.server} value={server} /> : null}
            <InfoRow
              label={t.dataUsed}
              value={formatBytes(status.bytesDownloaded + status.bytesUploaded)}
            />
            <AppText variant="caption" color="textMuted">
              {t.lossHint}
            </AppText>
          </Card>
        </>
      ) : null}

      {results.length > 0 ? (
        <>
          <SectionHeader title={t.history} />
          <Card>
            {results.map(({ id, data: result }) => (
              <InfoRow
                key={id}
                label={formatDateTime(result.finishedAt, language)}
                value={t.historyRow(
                  formatMbps(result.downloadMbps),
                  formatMbps(result.uploadMbps),
                  formatMs(result.idleLatencyMs, s),
                )}
              />
            ))}
          </Card>
          {running ? null : (
            <Button
              testID="speed-clear-history"
              label={t.clearHistory}
              variant="secondary"
              onPress={() => clearResults()}
            />
          )}
        </>
      ) : null}
    </ToolFrame>
  );
}

const styles = StyleSheet.create({
  metric: {
    width: '50%',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
