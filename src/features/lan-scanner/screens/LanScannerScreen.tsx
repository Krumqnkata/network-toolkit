import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '../../../app/theme';
import {
  AppText,
  Badge,
  Button,
  Card,
  InfoRow,
  ListRow,
  ProgressBar,
  SectionHeader,
} from '../../../components/common';
import { EquipmentPicture } from '../../../components/illustrations/EquipmentPicture';
import { Icon } from '../../../components/icons/Icon';
import { displayName, guessKind, modelName } from '../../../domain/algorithms/devices';
import { formatTime, useLanguage, useStrings } from '../../../i18n';
import { isLanScanning, useLanStore } from '../../../stores/lanStore';
import { ErrorNotice, FormCard, ToolFrame } from '../../network-tools/components/ToolFrame';
import { cancelLanScan, startLanScan } from '../services/lanScan';

/** LAN scanner body, used by the Devices tab and the LAN Scanner tool screen. */
export function LanScannerContent() {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const t = s.lan;
  const navigation = useNavigation();
  const { phase, progress, devices, info, error } = useLanStore();
  const scanning = isLanScanning(phase);

  const status =
    phase === 'probing'
      ? t.probing(Math.round((progress / 0.8) * 100))
      : phase === 'naming'
      ? t.naming
      : phase === 'identifying'
      ? t.identifying
      : info?.finishedAt
      ? t.lastScan(formatTime(info.finishedAt, language))
      : null;

  return (
    <>
      <FormCard>
        <AppText variant="caption" color="textSecondary">
          {t.intro}
        </AppText>
        {scanning ? (
          <Button testID="lan-stop" label={t.stop} variant="secondary" onPress={cancelLanScan} />
        ) : (
          <Button testID="lan-scan" label={t.scan} onPress={() => startLanScan()} />
        )}
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      {info ? (
        <Card>
          <InfoRow label={t.range} value={info.cidr} />
          {info.gateway ? <InfoRow label={t.gateway} value={info.gateway} /> : null}
          {info.truncated ? (
            <AppText variant="caption" color="warning">
              {t.truncated}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      {status ? (
        <View style={{ gap: theme.spacing.xs }}>
          <AppText testID="lan-status" variant="caption" color="textSecondary">
            {status}
          </AppText>
          {scanning ? <ProgressBar value={progress} label={status} /> : null}
        </View>
      ) : null}

      {devices.length > 0 ? (
        <>
          <SectionHeader title={t.found(devices.length)} />
          <Card padded={false}>
            {devices.map((device, index) => {
              const kind = guessKind(device);
              const name = displayName(device);
              const model = modelName(device);
              return (
                <ListRow
                  key={device.address}
                  testID={`lan-device-${device.address}`}
                  title={name ?? (device.isSelf ? t.thisDevice : t.kinds[kind])}
                  subtitle={[device.address, model].filter(Boolean).join(' · ')}
                  showDivider={index < devices.length - 1}
                  onPress={() => navigation.navigate('LanDevice', { address: device.address })}
                  leading={<EquipmentPicture kind={kind} size={40} />}
                  trailing={
                    device.isSelf ? (
                      <Badge label={t.thisDevice} tone="accent" />
                    ) : device.isGateway ? (
                      <Badge label={t.gateway} tone="accent" />
                    ) : (
                      <Icon name="chevronRight" color={theme.colors.textMuted} size={20} />
                    )
                  }
                />
              );
            })}
          </Card>
          <AppText variant="caption" color="textMuted" style={styles.note}>
            {t.macNote}
          </AppText>
        </>
      ) : !scanning && !error ? (
        <AppText variant="body" color="textSecondary">
          {t.empty}
        </AppText>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  note: {
    marginTop: 4,
  },
});

export function LanScannerScreen() {
  return (
    <ToolFrame toolId="lan-scanner">
      <LanScannerContent />
    </ToolFrame>
  );
}
