import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import {
  AppText,
  Button,
  Card,
  ProgressBar,
  SectionHeader,
  SegmentedControl,
  TextField,
} from '../../../components/common';
import { COMMON_PORTS, parsePortList, serviceName } from '../../../domain/algorithms/ports';
import { useStrings } from '../../../i18n';
import { ErrorNotice, FormCard, ToolFrame, formatMs } from '../components/ToolFrame';
import { usePortScan } from '../hooks/usePortScan';
import type { ToolScreenProps } from './ToolHostScreen';

type Preset = 'common' | 'well-known' | 'custom';

const WELL_KNOWN = Array.from({ length: 1024 }, (_, index) => index + 1);

export function PortScannerScreen({ initialHost }: ToolScreenProps) {
  const theme = useTheme();
  const s = useStrings();
  const t = s.ports;
  const [host, setHost] = useState(initialHost ?? '');
  const [preset, setPreset] = useState<Preset>('common');
  const [custom, setCustom] = useState('');
  const [hostError, setHostError] = useState<string | null>(null);
  const [portsError, setPortsError] = useState<string | null>(null);
  const { running, address, done, total, results, error, start, stop } = usePortScan();

  const onStart = () => {
    const target = host.trim();
    setHostError(target === '' ? s.netTools.invalidHost : null);
    let ports: number[] | null = preset === 'common' ? [...COMMON_PORTS] : WELL_KNOWN;
    if (preset === 'custom') ports = parsePortList(custom);
    setPortsError(ports ? null : t.invalidPorts);
    if (target === '' || !ports) return;
    start(target, ports);
  };

  const open = results.filter(result => result.status === 'open');
  const closed = results.filter(result => result.status === 'refused').length;
  const filtered = results.length - open.length - closed;

  return (
    <ToolFrame toolId="port-scanner">
      <FormCard>
        <AppText variant="caption" color="warning">
          {t.warning}
        </AppText>
        <TextField
          testID="ports-host"
          label={s.netTools.host}
          value={host}
          onChangeText={setHost}
          placeholder="192.168.1.1"
          keyboardType="url"
          error={hostError}
          editable={!running}
        />
        <SegmentedControl
          testID="ports-preset"
          accessibilityLabel={t.preset}
          options={[
            { value: 'common', label: t.presets.common(COMMON_PORTS.length) },
            { value: 'well-known', label: t.presets.wellKnown },
            { value: 'custom', label: t.presets.custom },
          ]}
          value={preset}
          onChange={setPreset}
        />
        {preset === 'custom' ? (
          <TextField
            testID="ports-custom"
            label={t.custom}
            value={custom}
            onChangeText={setCustom}
            placeholder={t.customPlaceholder}
            keyboardType="numbers-and-punctuation"
            error={portsError}
            editable={!running}
          />
        ) : null}
        {running ? (
          <Button testID="ports-stop" label={s.netTools.stop} variant="secondary" onPress={stop} />
        ) : (
          <Button testID="ports-start" label={s.netTools.start} onPress={onStart} />
        )}
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      {total > 0 ? (
        <>
          <View style={[styles.progress, { gap: theme.spacing.xs }]}>
            <AppText testID="ports-progress" variant="caption" color="textSecondary">
              {`${address ? `${address} · ` : ''}${t.progress(done, total)}`}
            </AppText>
            <ProgressBar value={done / total} label={t.progress(done, total)} />
            <AppText testID="ports-summary" variant="caption" color="textMuted">
              {t.summary(open.length, closed, filtered)}
            </AppText>
          </View>

          <SectionHeader title={t.open} />
          <Card padded={false}>
            {open.length === 0 ? (
              <AppText variant="body" color="textSecondary" style={{ padding: theme.spacing.lg }}>
                {running ? s.common.loading : t.noneOpen}
              </AppText>
            ) : (
              open.map(result => (
                <View
                  key={result.port}
                  testID={`open-port-${result.port}`}
                  accessible
                  accessibilityLabel={`${result.port} ${serviceName(result.port) ?? ''}`.trim()}
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
                  <AppText variant="mono" style={styles.port}>
                    {result.port}
                  </AppText>
                  <AppText variant="body" color="textSecondary" style={styles.flex}>
                    {serviceName(result.port) ?? '—'}
                  </AppText>
                  <AppText variant="caption" color="textMuted">
                    {formatMs(result.connectMs, s)}
                  </AppText>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}
    </ToolFrame>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  port: {
    minWidth: 56,
  },
  progress: {
    flexDirection: 'column',
  },
  row: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
});
