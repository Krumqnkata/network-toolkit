import React from 'react';

import { AppText, Button, Card, InfoRow, SectionHeader } from '../../../components/common';
import { useStrings } from '../../../i18n';
import { ErrorNotice, FormCard, ToolFrame } from '../components/ToolFrame';
import { useToolTask } from '../hooks/useToolTask';
import { lookupPublicIp, type PublicAddress, type PublicIpInfo } from '../services/ipInfo';

function AddressCard({ title, address }: { title: string; address: PublicAddress | null }) {
  const s = useStrings();
  const t = s.netTools.ipInfo;
  return (
    <>
      <SectionHeader title={title} />
      <Card>
        {address ? (
          <>
            <InfoRow label={s.netTools.address} value={address.ip} />
            <InfoRow
              label={t.asn}
              value={address.origin ? `AS${address.origin.asn}` : t.notAvailable}
            />
            <InfoRow
              label={t.provider}
              value={address.origin?.name ?? t.notAvailable}
              mono={false}
            />
            {address.origin ? <InfoRow label={t.prefix} value={address.origin.prefix} /> : null}
            {address.origin?.registry ? (
              <InfoRow label={t.registry} value={address.origin.registry.toUpperCase()} />
            ) : null}
            <InfoRow label={t.country} value={address.country ?? t.notAvailable} />
            <InfoRow label={t.colo} value={address.colo ?? t.notAvailable} />
          </>
        ) : (
          <AppText variant="body" color="textSecondary">
            {t.notAvailable}
          </AppText>
        )}
      </Card>
    </>
  );
}

export function IpInfoScreen() {
  const s = useStrings();
  const t = s.netTools.ipInfo;
  const { running, result, error, run } = useToolTask<PublicIpInfo>();

  return (
    <ToolFrame toolId="ip-info">
      <FormCard>
        <AppText variant="caption" color="textSecondary">
          {t.intro}
        </AppText>
        <Button
          testID="ip-info-run"
          label={t.lookup}
          onPress={() => run(() => lookupPublicIp())}
          busy={running}
        />
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      {result ? (
        <>
          <AddressCard title={t.publicIpv4} address={result.ipv4} />
          <AddressCard title={t.publicIpv6} address={result.ipv6} />
        </>
      ) : null}
    </ToolFrame>
  );
}
