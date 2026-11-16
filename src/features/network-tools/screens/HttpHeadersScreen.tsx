import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import {
  AppText,
  Badge,
  Button,
  Card,
  InfoRow,
  SectionHeader,
  SegmentedControl,
  TextField,
  type BadgeTone,
} from '../../../components/common';
import {
  httpStatusTone,
  normalizeUrl,
  securityHeaders,
  type StatusTone,
} from '../../../domain/algorithms/web';
import type { HttpResult } from '../../../domain/models/netTools';
import { useStrings } from '../../../i18n';
import { httpRequest } from '../../../native/netTools';
import { ErrorNotice, FormCard, ToolFrame, formatMs } from '../components/ToolFrame';
import { useToolTask } from '../hooks/useToolTask';

export const MAX_REDIRECTS = 10;

const TONE: Record<StatusTone, BadgeTone> = {
  success: 'success',
  info: 'accent',
  warning: 'warning',
  danger: 'danger',
};

export function HttpHeadersScreen() {
  const theme = useTheme();
  const s = useStrings();
  const t = s.netTools.http;
  const [url, setUrl] = useState('https://example.com');
  const [method, setMethod] = useState<'HEAD' | 'GET'>('HEAD');
  const [inputError, setInputError] = useState<string | null>(null);
  const { running, result, error, run } = useToolTask<HttpResult>();

  const onRun = () => {
    const value = normalizeUrl(url);
    if (value === '') {
      setInputError(s.netTools.errors['invalid-input']);
      return;
    }
    setInputError(null);
    setUrl(value);
    run(() => httpRequest(value, method, MAX_REDIRECTS));
  };

  const hops = result?.hops ?? [];
  const final = hops[hops.length - 1];
  const stillRedirecting =
    final !== undefined && final.status >= 300 && final.status < 400 && hops.length > MAX_REDIRECTS;

  return (
    <ToolFrame toolId="http-headers">
      <FormCard>
        <TextField
          testID="http-url"
          label={t.url}
          value={url}
          onChangeText={setUrl}
          placeholder={t.urlPlaceholder}
          keyboardType="url"
          onSubmitEditing={onRun}
          error={inputError}
        />
        <SegmentedControl
          testID="http-method"
          accessibilityLabel={t.method}
          options={[
            { value: 'HEAD', label: 'HEAD' },
            { value: 'GET', label: 'GET' },
          ]}
          value={method}
          onChange={setMethod}
        />
        <Button testID="http-run" label={s.netTools.run} onPress={onRun} busy={running} />
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      {final ? (
        <>
          {hops.length > 1 ? (
            <>
              <SectionHeader title={t.chain} />
              <Card padded={false}>
                {hops.map((hop, index) => (
                  <View
                    key={`${index}-${hop.url}`}
                    testID={`http-hop-${index}`}
                    style={[
                      styles.hop,
                      {
                        gap: theme.spacing.md,
                        paddingHorizontal: theme.spacing.lg,
                        paddingVertical: theme.spacing.sm,
                        borderBottomColor: theme.colors.border,
                      },
                    ]}
                  >
                    <Badge label={String(hop.status)} tone={TONE[httpStatusTone(hop.status)]} />
                    <AppText variant="mono" style={styles.flex} selectable>
                      {hop.url}
                    </AppText>
                    <AppText variant="caption" color="textMuted">
                      {formatMs(hop.durationMs, s)}
                    </AppText>
                  </View>
                ))}
              </Card>
              {stillRedirecting ? (
                <AppText variant="caption" color="warning">
                  {t.tooManyRedirects}
                </AppText>
              ) : null}
            </>
          ) : null}

          <SectionHeader title={t.final} />
          <Card>
            <View
              style={[styles.status, { gap: theme.spacing.sm, marginBottom: theme.spacing.sm }]}
            >
              <Badge
                label={`${final.status} ${final.statusText}`.trim()}
                tone={TONE[httpStatusTone(final.status)]}
              />
            </View>
            <InfoRow label={t.url} value={final.url} />
            <InfoRow label={s.netTools.duration} value={formatMs(final.durationMs, s)} />
            {final.protocol ? <InfoRow label={t.protocol} value={final.protocol} /> : null}
            {final.cipherSuite ? <InfoRow label={t.cipher} value={final.cipherSuite} /> : null}
            {final.url.startsWith('http:') ? (
              <AppText variant="caption" color="warning">
                {t.cleartext}
              </AppText>
            ) : null}
          </Card>

          <SectionHeader title={t.security} />
          <Card>
            {securityHeaders(final.headers).map(header => (
              <View
                key={header.name}
                testID={`security-${header.name}`}
                style={[styles.status, { justifyContent: 'space-between', paddingVertical: 4 }]}
              >
                <AppText variant="mono">{header.name}</AppText>
                <Badge
                  label={header.present ? t.present : t.missing}
                  tone={header.present ? 'success' : 'neutral'}
                />
              </View>
            ))}
          </Card>

          <SectionHeader title={t.headers} />
          <Card>
            {final.headers.map((header, index) => (
              <InfoRow key={`${header.name}-${index}`} label={header.name} value={header.value} />
            ))}
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
  hop: {
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
  },
  status: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
