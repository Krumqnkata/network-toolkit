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
  TextField,
  type BadgeTone,
} from '../../../components/common';
import {
  certificateValidity,
  daysUntil,
  dnDisplayName,
  parseHostPort,
  type CertificateValidity,
} from '../../../domain/algorithms/web';
import type { CertificateInfo, TlsResult } from '../../../domain/models/netTools';
import { LOCALES, useLanguage, useStrings } from '../../../i18n';
import { tlsInspect } from '../../../native/netTools';
import { ErrorNotice, FormCard, ToolFrame, formatMs } from '../components/ToolFrame';
import { useToolTask } from '../hooks/useToolTask';

const VALIDITY_TONE: Record<CertificateValidity, BadgeTone> = {
  valid: 'success',
  expiring: 'warning',
  expired: 'danger',
  'not-yet-valid': 'danger',
};

const MAX_NAMES = 8;

function CertificateCard({
  cert,
  index,
  total,
  now,
}: {
  cert: CertificateInfo;
  index: number;
  total: number;
  now: number;
}) {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const t = s.netTools.tls;
  const validity = certificateValidity(cert.notBefore, cert.notAfter, now);
  const role = index === 0 ? t.leaf : index === total - 1 && cert.isCa ? t.root : t.intermediate;
  const date = (value: number) =>
    new Date(value).toLocaleDateString(LOCALES[language], {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  const names = cert.subjectAltNames;
  const shownNames = names.slice(0, MAX_NAMES);

  return (
    <Card testID={`cert-${index}`}>
      <View style={[styles.header, { gap: theme.spacing.sm, marginBottom: theme.spacing.sm }]}>
        <View style={styles.flex}>
          <AppText variant="overline" color="textMuted">
            {role}
          </AppText>
          <AppText variant="heading" selectable>
            {dnDisplayName(cert.subject)}
          </AppText>
        </View>
        <Badge label={t.validity[validity]} tone={VALIDITY_TONE[validity]} />
      </View>
      <InfoRow label={t.issuer} value={dnDisplayName(cert.issuer)} mono={false} />
      <InfoRow label={t.validFrom} value={date(cert.notBefore)} mono={false} />
      <InfoRow
        label={t.validTo}
        value={
          validity === 'valid' || validity === 'expiring'
            ? [date(cert.notAfter), t.daysLeft(daysUntil(cert.notAfter, now))]
            : date(cert.notAfter)
        }
        mono={false}
      />
      {shownNames.length > 0 ? (
        <InfoRow
          label={t.sans}
          value={
            names.length > MAX_NAMES
              ? [...shownNames, t.moreNames(names.length - MAX_NAMES)]
              : shownNames
          }
        />
      ) : null}
      <InfoRow
        label={t.key}
        value={t.keyValue(cert.publicKeyAlgorithm, cert.publicKeyBits?.toString() ?? '')}
      />
      <InfoRow label={t.signature} value={cert.signatureAlgorithm} />
      <InfoRow label={t.serial} value={cert.serialNumber} />
      <InfoRow label={t.sha256} value={cert.sha256} />
      <InfoRow label={t.subject} value={cert.subject} />
    </Card>
  );
}

export function TlsCertificateScreen() {
  const theme = useTheme();
  const s = useStrings();
  const t = s.netTools.tls;
  const [input, setInput] = useState('example.com');
  const [inputError, setInputError] = useState<string | null>(null);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const { running, result, error, run } = useToolTask<TlsResult>();

  const onRun = () => {
    const target = parseHostPort(input);
    if (!target || (target.port !== null && !(target.port >= 1 && target.port <= 65535))) {
      setInputError(s.netTools.invalidHost);
      return;
    }
    setInputError(null);
    setCheckedAt(Date.now());
    run(() => tlsInspect(target.host, target.port ?? 443));
  };

  return (
    <ToolFrame toolId="tls-certificate">
      <FormCard>
        <TextField
          testID="tls-host"
          label={s.netTools.host}
          value={input}
          onChangeText={setInput}
          placeholder={t.hostPlaceholder}
          keyboardType="url"
          onSubmitEditing={onRun}
          error={inputError}
        />
        <Button testID="tls-run" label={s.netTools.run} onPress={onRun} busy={running} />
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      {result ? (
        <>
          <Card>
            <View
              style={[styles.badges, { gap: theme.spacing.sm, marginBottom: theme.spacing.sm }]}
            >
              <Badge
                label={result.trusted ? t.trusted : t.untrusted}
                tone={result.trusted ? 'success' : 'danger'}
              />
              <Badge
                label={result.hostnameMatches ? t.hostnameOk : t.hostnameMismatch}
                tone={result.hostnameMatches ? 'success' : 'danger'}
              />
            </View>
            {result.trustError ? (
              <InfoRow label={t.trustError} value={result.trustError} mono={false} />
            ) : null}
            <InfoRow label={s.netTools.address} value={result.address} />
            <InfoRow label={t.protocol} value={result.protocol} />
            <InfoRow label={t.cipher} value={result.cipherSuite} />
            <InfoRow label={t.handshake} value={formatMs(result.handshakeMs, s)} />
          </Card>

          <SectionHeader title={t.chain} />
          {result.chain.map((cert, index) => (
            <CertificateCard
              key={cert.sha256}
              cert={cert}
              index={index}
              total={result.chain.length}
              now={checkedAt}
            />
          ))}
        </>
      ) : null}
    </ToolFrame>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
});
