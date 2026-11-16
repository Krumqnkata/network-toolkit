import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { AppText, Button, Card, SectionHeader, TextField } from '../../../components/common';
import { useStrings } from '../../../i18n';
import type { ToolScreenProps } from './ToolHostScreen';
import { ErrorNotice, FormCard, ToolFrame, formatMs } from '../components/ToolFrame';
import { useTraceroute } from '../hooks/useTraceroute';

export function TracerouteScreen({ initialHost }: ToolScreenProps) {
  const theme = useTheme();
  const s = useStrings();
  const t = s.netTools;
  const [host, setHost] = useState(initialHost ?? 'one.one.one.one');
  const [inputError, setInputError] = useState<string | null>(null);
  const { running, hops, target, outcome, error, start, stop } = useTraceroute();

  const onStart = () => {
    const value = host.trim();
    if (value === '') {
      setInputError(t.invalidHost);
      return;
    }
    setInputError(null);
    start(value);
  };

  const outcomeText =
    outcome === 'reached'
      ? t.traceroute.reached(hops.length)
      : outcome === 'stopped-early'
      ? t.traceroute.stoppedEarly
      : outcome === 'not-reached'
      ? t.traceroute.notReached
      : null;

  return (
    <ToolFrame toolId="traceroute">
      <FormCard>
        <TextField
          testID="traceroute-host"
          label={t.host}
          value={host}
          onChangeText={setHost}
          placeholder={t.hostPlaceholder}
          keyboardType="url"
          onSubmitEditing={onStart}
          error={inputError}
          editable={!running}
        />
        <AppText variant="caption" color="textSecondary">
          {t.traceroute.ipv4Only}
        </AppText>
        {running ? (
          <Button testID="traceroute-stop" label={t.stop} variant="secondary" onPress={stop} />
        ) : (
          <Button testID="traceroute-start" label={t.start} onPress={onStart} />
        )}
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      {hops.length > 0 || running ? (
        <>
          <SectionHeader title={target ? `${t.traceroute.hops} · ${target}` : t.traceroute.hops} />
          <Card padded={false}>
            {hops.map(hop => (
              <View
                key={hop.ttl}
                testID={`hop-${hop.ttl}`}
                accessible
                accessibilityLabel={`${t.traceroute.hopLabel(hop.ttl)}: ${
                  hop.address ?? t.traceroute.noReply
                }${hop.rttMs !== null ? `, ${formatMs(hop.rttMs, s)}` : ''}`}
                style={[
                  styles.row,
                  {
                    gap: theme.spacing.md,
                    paddingHorizontal: theme.spacing.lg,
                    paddingVertical: theme.spacing.sm,
                    borderBottomColor: theme.colors.border,
                  },
                ]}
              >
                <AppText variant="mono" color="textMuted" style={styles.ttl}>
                  {hop.ttl}
                </AppText>
                <View style={styles.body}>
                  <AppText
                    variant="mono"
                    color={hop.address ? 'textPrimary' : 'textMuted'}
                    selectable
                  >
                    {hop.address ?? t.traceroute.noReply}
                  </AppText>
                  {hop.hostname ? (
                    <AppText variant="caption" color="textSecondary" selectable>
                      {hop.hostname}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="mono" color="textSecondary">
                  {hop.rttMs !== null ? formatMs(hop.rttMs, s) : '—'}
                </AppText>
              </View>
            ))}
            {running ? (
              <View style={{ padding: theme.spacing.md }}>
                <ActivityIndicator color={theme.colors.accent} />
              </View>
            ) : null}
          </Card>
        </>
      ) : null}

      {outcomeText ? (
        <AppText
          testID="traceroute-outcome"
          variant="caption"
          color={outcome === 'reached' ? 'success' : 'warning'}
        >
          {outcomeText}
        </AppText>
      ) : null}
    </ToolFrame>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  ttl: {
    minWidth: 24,
  },
});
