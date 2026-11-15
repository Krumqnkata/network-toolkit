import React from 'react';

import { Card, InfoRow } from '../../../components/common';
import type { NetworkSnapshot } from '../../../domain/models/network';
import { useStrings } from '../../../i18n';
import { displayAddresses, formatKbps } from '../format';

export function IpConfigCard({ snapshot }: { snapshot: NetworkSnapshot }) {
  const s = useStrings();
  const fields = s.dashboard.fields;
  const { ipv4, ipv6 } = displayAddresses(snapshot.addresses);

  const privateDns =
    snapshot.privateDnsActive === null
      ? null
      : snapshot.privateDnsActive
      ? s.dashboard.privateDnsOn(snapshot.privateDnsServer)
      : s.dashboard.privateDnsOff;

  const rows: { label: string; value: string | string[] | null; testID?: string }[] = [
    { label: fields.interface, value: snapshot.interfaceName },
    { label: fields.ipv4, value: ipv4.length ? ipv4 : null, testID: 'ipv4' },
    { label: fields.ipv6, value: ipv6.length ? ipv6 : null },
    { label: fields.gateway, value: snapshot.gateways.length ? snapshot.gateways : null },
    { label: fields.dns, value: snapshot.dnsServers.length ? snapshot.dnsServers : null },
    { label: fields.privateDns, value: privateDns },
    { label: fields.domain, value: snapshot.domains },
    { label: fields.mtu, value: snapshot.mtu === null ? null : String(snapshot.mtu) },
    {
      label: fields.bandwidth,
      value:
        snapshot.downstreamKbps === null && snapshot.upstreamKbps === null
          ? null
          : `↓ ${formatKbps(snapshot.downstreamKbps) ?? '—'}  ↑ ${
              formatKbps(snapshot.upstreamKbps) ?? '—'
            }`,
    },
  ];

  return (
    <Card testID="ip-card">
      {rows.map(row =>
        row.value === null ? null : (
          <InfoRow key={row.label} label={row.label} value={row.value} testID={row.testID} />
        ),
      )}
    </Card>
  );
}
