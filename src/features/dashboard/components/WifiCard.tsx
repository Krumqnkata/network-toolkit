import React from 'react';
import { View } from 'react-native';

import { useTheme } from '../../../app/theme';
import { AppText, Card, InfoRow } from '../../../components/common';
import { SignalMeter } from '../../../components/indicators/SignalMeter';
import { wifiStandardLabel } from '../../../domain/algorithms/wifi';
import type { NetworkSnapshot, WifiLink } from '../../../domain/models/network';
import { useStrings } from '../../../i18n';
import { formatBand, formatChannel, formatMbps, formatTxRx, ssidBlocker } from '../format';
import { LocationNotice } from './LocationNotice';

export interface WifiCardProps {
  snapshot: NetworkSnapshot & { wifi: WifiLink };
  onPermissionGranted: () => void;
}

export function WifiCard({ snapshot, onPermissionGranted }: WifiCardProps) {
  const theme = useTheme();
  const s = useStrings();
  const { wifi } = snapshot;
  const blocker = ssidBlocker(snapshot);
  const fields = s.dashboard.fields;

  const ssidText = wifi.ssid ?? (wifi.hiddenSsid ? fields.hiddenNetwork : s.dashboard.notAvailable);

  // Optional rows are omitted rather than shown as "unknown".
  const rows: { label: string; value: string | null }[] = [
    { label: fields.bssid, value: wifi.bssid },
    { label: fields.band, value: formatBand(wifi.frequencyMhz) },
    { label: fields.channel, value: formatChannel(wifi.frequencyMhz) },
    {
      label: fields.frequency,
      value: wifi.frequencyMhz === null ? null : `${wifi.frequencyMhz} MHz`,
    },
    { label: fields.linkSpeed, value: formatMbps(wifi.linkSpeedMbps) },
    { label: fields.txRx, value: formatTxRx(wifi.txLinkSpeedMbps, wifi.rxLinkSpeedMbps) },
    { label: fields.maxLinkSpeed, value: formatMbps(wifi.maxTxLinkSpeedMbps) },
    { label: fields.standard, value: wifiStandardLabel(wifi.wifiStandard) },
    { label: fields.security, value: wifi.security ? s.security[wifi.security] : null },
  ];

  return (
    <Card testID="wifi-card" style={{ gap: theme.spacing.md }}>
      <View style={{ gap: theme.spacing.xxs }}>
        <AppText variant="caption" color="textMuted">
          {fields.ssid}
        </AppText>
        <AppText variant="title" selectable testID="wifi-ssid">
          {ssidText}
        </AppText>
      </View>

      {blocker ? <LocationNotice reason={blocker} onGranted={onPermissionGranted} /> : null}

      {wifi.rssi !== null ? (
        <SignalMeter
          rssi={wifi.rssi}
          label={s.dashboard.signal}
          qualityLabel={quality => s.signalQuality[quality]}
        />
      ) : null}

      <View>
        {rows.map(row =>
          row.value === null ? null : (
            <InfoRow key={row.label} label={row.label} value={row.value} />
          ),
        )}
      </View>
    </Card>
  );
}
