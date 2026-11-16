import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import type { RootStackParamList } from '../../../app/navigation/types';
import { useTheme } from '../../../app/theme';
import {
  AppText,
  Button,
  Card,
  EmptyState,
  InfoRow,
  Screen,
  SectionHeader,
} from '../../../components/common';
import { Icon } from '../../../components/icons/Icon';
import { displayName, guessKind, modelName } from '../../../domain/algorithms/devices';
import { serviceName } from '../../../domain/algorithms/ports';
import { isRandomizedMac } from '../../../domain/algorithms/subnet';
import { useStrings } from '../../../i18n';
import { useLanStore } from '../../../stores/lanStore';
import { formatMs } from '../../network-tools/components/ToolFrame';
import { KIND_ICON } from '../components/deviceIcon';

type Props = NativeStackScreenProps<RootStackParamList, 'LanDevice'>;

export function LanDeviceScreen({ route, navigation }: Props) {
  const theme = useTheme();
  const s = useStrings();
  const t = s.lan;
  const d = t.device;
  const device = useLanStore(state =>
    state.devices.find(candidate => candidate.address === route.params.address),
  );

  if (!device) {
    return (
      <Screen
        title={route.params.address}
        onBack={() => navigation.goBack()}
        backLabel={s.tools.items['lan-scanner'].name}
      >
        <EmptyState title={d.notFound} />
      </Screen>
    );
  }

  const kind = guessKind(device);
  const name = displayName(device) ?? (device.isSelf ? t.thisDevice : t.kinds[kind]);
  const model = modelName(device);
  const web = device.openPorts.includes(443)
    ? 'https'
    : device.openPorts.includes(80)
    ? 'http'
    : null;

  return (
    <Screen
      title={name}
      subtitle={device.address}
      onBack={() => navigation.goBack()}
      backLabel={s.tools.items['lan-scanner'].name}
    >
      <Card>
        <View style={[styles.kind, { gap: theme.spacing.sm, marginBottom: theme.spacing.sm }]}>
          <Icon name={KIND_ICON[kind]} color={theme.colors.accent} />
          <AppText variant="heading">
            {device.isGateway ? t.gateway : device.isSelf ? t.thisDevice : t.kinds[kind]}
          </AppText>
        </View>
        <InfoRow label={d.address} value={device.address} />
        {model ? <InfoRow label={d.model} value={model} mono={false} /> : null}
        {device.hostname ? <InfoRow label={d.hostname} value={device.hostname} /> : null}
        {device.mdnsHost ? <InfoRow label={d.mdnsHost} value={device.mdnsHost} /> : null}
        {device.netbiosName ? <InfoRow label={d.netbios} value={device.netbiosName} /> : null}
        {device.workgroup ? <InfoRow label={d.workgroup} value={device.workgroup} /> : null}
        {device.mac ? (
          <InfoRow
            label={d.mac}
            value={isRandomizedMac(device.mac) ? d.macRandomized(device.mac) : device.mac}
          />
        ) : null}
        {device.upnp?.server ? <InfoRow label={d.upnpServer} value={device.upnp.server} /> : null}
        {device.rttMs !== null ? (
          <InfoRow label={d.latency} value={formatMs(device.rttMs, s)} />
        ) : null}
        <InfoRow label={d.foundBy} value={t.sources[device.source]} />
      </Card>

      {device.isSelf ? null : (
        <View style={[styles.actions, { gap: theme.spacing.sm }]}>
          <Button
            testID="device-ping"
            label={d.ping}
            variant="secondary"
            onPress={() => navigation.navigate('Tool', { toolId: 'ping', host: device.address })}
          />
          <Button
            testID="device-ports"
            label={d.scanPorts}
            variant="secondary"
            onPress={() =>
              navigation.navigate('Tool', { toolId: 'port-scanner', host: device.address })
            }
          />
          {web ? (
            <Button
              testID="device-open"
              label={d.openBrowser}
              variant="secondary"
              onPress={() => Linking.openURL(`${web}://${device.address}/`)}
            />
          ) : null}
        </View>
      )}

      {device.openPorts.length > 0 ? (
        <>
          <SectionHeader title={d.openPorts} />
          <Card>
            {device.openPorts.map(port => (
              <InfoRow
                key={port}
                label={String(port)}
                value={serviceName(port) ?? '—'}
                mono={false}
              />
            ))}
            <AppText variant="caption" color="textMuted">
              {d.openPortsHint}
            </AppText>
          </Card>
        </>
      ) : null}

      {device.services.length > 0 ? (
        <>
          <SectionHeader title={d.services} />
          <Card>
            {device.services.map(service => (
              <InfoRow
                key={`${service.type}-${service.instance}`}
                label={service.type}
                value={
                  service.port !== null
                    ? `${service.instance} · :${service.port}`
                    : service.instance
                }
                mono={false}
              />
            ))}
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  kind: {
    alignItems: 'center',
    flexDirection: 'row',
  },
});
