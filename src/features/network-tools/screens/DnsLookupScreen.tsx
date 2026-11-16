import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import {
  AppText,
  Badge,
  Button,
  Card,
  ChoiceChips,
  InfoRow,
  SectionHeader,
  TextField,
} from '../../../components/common';
import {
  DNS_RECORD_TYPE_NAMES,
  DNS_RECORD_TYPES,
  DNS_SERVERS,
  formatTtl,
  rcodeName,
  recordTypeName,
  type DnsRecordTypeName,
  type DnsServerOption,
} from '../../../domain/algorithms/dns';
import { isIpAddress, reverseDnsName } from '../../../domain/algorithms/ip';
import type { DnsQueryResult, DnsRecord } from '../../../domain/models/netTools';
import { useStrings } from '../../../i18n';
import { dnsQuery } from '../../../native/netTools';
import { ErrorNotice, FormCard, ToolFrame, formatMs } from '../components/ToolFrame';
import { useToolTask } from '../hooks/useToolTask';

export type DnsMode = 'lookup' | 'reverse';

interface Query {
  name: string;
  type: DnsRecordTypeName;
}

function RecordList({ records }: { records: DnsRecord[] }) {
  const theme = useTheme();
  const s = useStrings();
  return (
    <Card padded={false}>
      {records.map((record, index) => (
        <View
          key={`${record.type}-${record.data}-${index}`}
          testID="dns-record"
          style={[
            styles.record,
            {
              gap: theme.spacing.xs,
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.sm,
              borderBottomColor: theme.colors.border,
            },
          ]}
        >
          <View style={[styles.recordHeader, { gap: theme.spacing.sm }]}>
            <Badge label={recordTypeName(record.type)} tone="accent" />
            <AppText variant="caption" color="textMuted" style={styles.flex}>
              {record.name}
            </AppText>
            <AppText variant="caption" color="textMuted">
              {`${s.netTools.dns.ttl} ${formatTtl(record.ttl)}`}
            </AppText>
          </View>
          <AppText variant="mono" selectable>
            {record.data}
          </AppText>
        </View>
      ))}
    </Card>
  );
}

export function DnsLookupScreen({ mode }: { mode: DnsMode }) {
  const s = useStrings();
  const t = s.netTools.dns;
  const reverse = mode === 'reverse';
  const [input, setInput] = useState(reverse ? '1.1.1.1' : 'example.com');
  const [type, setType] = useState<DnsRecordTypeName>('A');
  const [server, setServer] = useState<DnsServerOption['id']>('system');
  const [inputError, setInputError] = useState<string | null>(null);
  const [query, setQuery] = useState<Query | null>(null);
  const { running, result, error, run } = useToolTask<DnsQueryResult>();

  const onRun = () => {
    const value = input.trim();
    let name = value;
    let queryType = type;
    if (reverse) {
      const ptr = isIpAddress(value) ? reverseDnsName(value) : null;
      if (!ptr) {
        setInputError(t.invalidIp);
        return;
      }
      name = ptr;
      queryType = 'PTR';
    } else if (value === '') {
      setInputError(s.netTools.invalidHost);
      return;
    }
    setInputError(null);
    setQuery({ name, type: queryType });
    const address = DNS_SERVERS.find(option => option.id === server)?.address ?? null;
    run(() => dnsQuery(name, DNS_RECORD_TYPES[queryType], address));
  };

  const answers = result?.answers ?? [];
  const matching = query
    ? answers.filter(record => record.type === DNS_RECORD_TYPES[query.type])
    : [];

  return (
    <ToolFrame toolId={reverse ? 'reverse-dns' : 'dns-lookup'}>
      <FormCard>
        <TextField
          testID="dns-input"
          label={reverse ? t.ip : t.name}
          value={input}
          onChangeText={setInput}
          placeholder={reverse ? t.ipPlaceholder : t.namePlaceholder}
          keyboardType={reverse ? 'numbers-and-punctuation' : 'url'}
          onSubmitEditing={onRun}
          error={inputError}
        />
        {reverse ? null : (
          <View style={styles.field}>
            <AppText variant="caption" color="textSecondary">
              {t.type}
            </AppText>
            <ChoiceChips
              testID="dns-type"
              accessibilityLabel={t.type}
              options={DNS_RECORD_TYPE_NAMES.filter(name => name !== 'PTR').map(name => ({
                value: name,
                label: name,
              }))}
              value={type}
              onChange={setType}
            />
          </View>
        )}
        <View style={styles.field}>
          <AppText variant="caption" color="textSecondary">
            {t.server}
          </AppText>
          <ChoiceChips
            testID="dns-server"
            accessibilityLabel={t.server}
            options={DNS_SERVERS.map(option => ({
              value: option.id,
              label: option.address
                ? `${t.servers[option.id]} (${option.address})`
                : t.servers[option.id],
            }))}
            value={server}
            onChange={setServer}
          />
        </View>
        <Button testID="dns-run" label={s.netTools.run} onPress={onRun} busy={running} />
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      {result && query ? (
        <>
          <SectionHeader title={t.response} />
          <Card>
            <InfoRow label={t.queryName} value={`${query.name} ${query.type}`} />
            <InfoRow testID="dns-rcode" label={t.rcode} value={rcodeName(result.rcode)} />
            <InfoRow
              label={t.serverUsed}
              value={result.server === 'system' ? t.systemResolver : result.server}
            />
            <InfoRow label={s.netTools.duration} value={formatMs(result.durationMs, s)} />
            {result.authoritative ? <InfoRow label={t.authoritative} value={s.common.yes} /> : null}
            {result.truncated ? <InfoRow label={t.truncated} value={s.common.yes} /> : null}
          </Card>

          <SectionHeader title={reverse ? t.hostnames : t.answers} />
          {answers.length > 0 ? (
            <RecordList records={answers} />
          ) : (
            <Card>
              <AppText testID="dns-empty" variant="body" color="textSecondary">
                {reverse ? t.noPtr : t.noRecords(query.type)}
              </AppText>
            </Card>
          )}
          {matching.length === 0 && result.authority.length > 0 ? (
            <>
              <SectionHeader title={t.authority} />
              <RecordList records={result.authority} />
            </>
          ) : null}
        </>
      ) : null}
    </ToolFrame>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  flex: {
    flex: 1,
  },
  record: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  recordHeader: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
