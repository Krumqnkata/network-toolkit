import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '../../../app/theme';
import { AppText, Badge, Button, Card, InfoRow } from '../../../components/common';
import { guessBluetoothKind } from '../../../domain/algorithms/bluetooth';
import { displayName, guessKind, modelName } from '../../../domain/algorithms/devices';
import { buildTopology, type TopoNode, type Topology } from '../../../domain/algorithms/topology';
import { formatTime, useLanguage, useStrings } from '../../../i18n';
import { useBluetoothStore } from '../../../stores/bluetoothStore';
import { isLanScanning, useLanStore } from '../../../stores/lanStore';
import { useTopologyStore } from '../../../stores/topologyStore';
import { useWifiScanStore } from '../../../stores/wifiScanStore';
import { ErrorNotice, FormCard } from '../../network-tools/components/ToolFrame';
import { TopologyMap, useNodeTitle } from '../components/TopologyMap';
import { TRACE_TARGET, buildTopologyMap, cancelTopologyMap } from '../services/topologyScan';

/** Combines the map's own measurements with the LAN, Wi-Fi and Bluetooth stores. */
function useTopology(): Topology | null {
  const { snapshot, hops, gatewayRttMs } = useTopologyStore();
  const lan = useLanStore(state => state.devices);
  const networks = useWifiScanStore(state => state.result?.networks ?? null);
  const bluetooth = useBluetoothStore(state => state.devices);

  return useMemo(() => {
    if (!snapshot || snapshot.transport === 'none') return null;
    const gateway =
      snapshot.transport === 'cellular'
        ? null
        : snapshot.gateways.find(address => address.includes('.')) ?? null;
    return buildTopology({
      transport: snapshot.transport,
      gateway,
      localAddress: snapshot.addresses.find(address => address.family === 'ipv4')?.address ?? null,
      deviceName: snapshot.deviceName,
      wifi: snapshot.wifi
        ? {
            ssid: snapshot.wifi.ssid,
            bssid: snapshot.wifi.bssid,
            frequencyMhz: snapshot.wifi.frequencyMhz,
            rssi: snapshot.wifi.rssi,
          }
        : null,
      operator: snapshot.cellularOperator,
      gatewayRttMs,
      target: TRACE_TARGET,
      hops,
      networks: networks ?? [],
      lan: lan.map(device => ({
        address: device.address,
        name: displayName(device),
        kind: guessKind(device),
        model: modelName(device),
        rttMs: device.rttMs,
        isSelf: device.isSelf,
        isGateway: device.isGateway || device.address === gateway,
      })),
      bluetooth: bluetooth.map(device => ({
        address: device.address,
        name: device.name,
        kind: guessBluetoothKind(device),
        rssi: device.rssi,
      })),
    });
  }, [snapshot, hops, gatewayRttMs, lan, networks, bluetooth]);
}

/** Network map body, shown in the Devices tab. */
export function TopologyContent() {
  const theme = useTheme();
  const s = useStrings();
  const language = useLanguage();
  const t = s.topology;
  const { phase, snapshot, hops, builtAt, error } = useTopologyStore();
  const lanPhase = useLanStore(state => state.phase);
  const lanCount = useLanStore(state => state.devices.length);
  const topology = useTopology();
  const window = useWindowDimensions();
  // Measured on layout; until then, the window minus the screen's side padding.
  const [width, setWidth] = useState(Math.max(0, Math.floor(window.width - 2 * theme.spacing.lg)));
  const [selected, setSelected] = useState<string | null>(null);
  const building = phase === 'building';
  const tracing =
    building && !hops.some(hop => hop.status === 'reply' || hop.status === 'unreachable');

  const status = building
    ? tracing
      ? t.tracing(hops.length)
      : isLanScanning(lanPhase)
      ? t.findingDevices(lanCount)
      : null
    : builtAt
    ? t.builtAt(formatTime(builtAt, language))
    : null;

  const selectedNode = topology?.nodes.find(node => node.id === selected) ?? null;

  return (
    <>
      <FormCard>
        <AppText variant="caption" color="textSecondary">
          {t.intro}
        </AppText>
        {building ? (
          <Button
            testID="topology-stop"
            label={t.stop}
            variant="secondary"
            onPress={cancelTopologyMap}
          />
        ) : (
          <Button
            testID="topology-build"
            label={builtAt ? t.rebuild : t.build}
            onPress={() => {
              setSelected(null);
              buildTopologyMap();
            }}
          />
        )}
        {status ? (
          <AppText testID="topology-status" variant="caption" color="textSecondary">
            {status}
          </AppText>
        ) : null}
      </FormCard>

      {error ? <ErrorNotice error={error} /> : null}

      {snapshot?.transport === 'none' ? (
        <Card>
          <AppText testID="topology-offline" color="textSecondary">
            {t.notConnected}
          </AppText>
        </Card>
      ) : null}

      {topology ? (
        <>
          <Card padded={false}>
            <View
              style={{ paddingVertical: theme.spacing.lg }}
              onLayout={event => setWidth(Math.floor(event.nativeEvent.layout.width))}
            >
              {width > 0 ? (
                <TopologyMap
                  topology={topology}
                  width={width}
                  selected={selected}
                  onSelect={id => setSelected(previous => (previous === id ? null : id))}
                />
              ) : null}
            </View>
          </Card>
          {selectedNode ? (
            <NodeDetails
              node={selectedNode}
              topology={topology}
              onClose={() => setSelected(null)}
            />
          ) : null}
          <Notes topology={topology} />
        </>
      ) : null}
    </>
  );
}

function NodeDetails({
  node,
  topology,
  onClose,
}: {
  node: TopoNode;
  topology: Topology;
  onClose: () => void;
}) {
  const theme = useTheme();
  const t = useStrings().topology;
  const title = useNodeTitle();
  const navigation = useNavigation();
  const ms = (value: number | null) => (value === null ? '—' : `${Math.round(value)} ms`);
  const unreachedTop = !topology.reached && node.parent === 'internet';

  return (
    <Card testID="topology-details">
      <View style={[styles.row, { gap: theme.spacing.sm, marginBottom: theme.spacing.sm }]}>
        <AppText variant="heading" style={styles.flex}>
          {title(node)}
        </AppText>
        {node.connected ? <Badge label={t.connected} tone="success" /> : null}
      </View>
      <InfoRow
        label={t.fields.type}
        value={t.types[node.type === 'more' ? 'hop' : node.type]}
        mono={false}
      />
      {node.hopRole ? (
        <AppText variant="caption" color="textSecondary" style={{ marginBottom: theme.spacing.sm }}>
          {t.hopRoles[node.hopRole]}
        </AppText>
      ) : null}
      {node.address ? <InfoRow label={t.fields.address} value={node.address} /> : null}
      {node.vendor ? <InfoRow label={t.fields.vendor} value={node.vendor} mono={false} /> : null}
      {node.detail && node.type !== 'ap' ? (
        <InfoRow label={t.fields.model} value={node.detail} mono={false} />
      ) : null}
      {node.bands?.length ? (
        <InfoRow
          label={t.fields.bands}
          value={node.bands.map(band => `${band} GHz`).join(' · ')}
          mono={false}
        />
      ) : null}
      {node.type === 'ap' && node.count ? (
        <InfoRow label={t.fields.radios} value={String(node.count)} />
      ) : null}
      {node.rttMs !== null ? <InfoRow label={t.fields.rtt} value={ms(node.rttMs)} /> : null}
      {node.signalDbm !== undefined && node.signalDbm !== null ? (
        <InfoRow label={t.fields.signal} value={`${node.signalDbm} dBm`} />
      ) : null}
      {node.link ? (
        <InfoRow
          label={t.fields.link}
          value={`${t.links[node.link]} · ${
            unreachedTop ? t.notReachedDelay : t.states[node.linkState]
          }`}
          testID="topology-link"
          mono={false}
        />
      ) : null}
      {node.linkMs !== null && node.link !== 'lan' ? (
        <InfoRow label={t.fields.addedDelay} value={`+${ms(node.linkMs)}`} />
      ) : null}
      <View style={[styles.row, { gap: theme.spacing.sm, marginTop: theme.spacing.md }]}>
        {node.type === 'lan' && node.address ? (
          <Button
            testID="topology-open-device"
            label={t.actions.details}
            variant="secondary"
            onPress={() => navigation.navigate('LanDevice', { address: node.address! })}
          />
        ) : null}
        {node.type === 'bluetooth' && node.address ? (
          <Button
            testID="topology-open-device"
            label={t.actions.details}
            variant="secondary"
            onPress={() => navigation.navigate('BluetoothDevice', { address: node.address! })}
          />
        ) : null}
        {node.address && node.type !== 'bluetooth' && node.type !== 'ap' && node.type !== 'self' ? (
          <Button
            testID="topology-ping"
            label={t.actions.ping}
            variant="secondary"
            onPress={() => navigation.navigate('Tool', { toolId: 'ping', host: node.address! })}
          />
        ) : null}
        <Button label={t.actions.close} variant="secondary" onPress={onClose} />
      </View>
    </Card>
  );
}

function Notes({ topology }: { topology: Topology }) {
  const theme = useTheme();
  const t = useStrings().topology;
  const notes: { id: string; text: string; tone: 'warning' | 'info' }[] = [];
  if (topology.doubleNat)
    notes.push({ id: 'double-nat', text: t.notes.doubleNat, tone: 'warning' });
  if (topology.cgnat) notes.push({ id: 'cgnat', text: t.notes.cgnat, tone: 'info' });
  if (!topology.reached && topology.nodes.some(node => node.type === 'hop'))
    notes.push({ id: 'not-reached', text: t.notes.notReached, tone: 'warning' });
  if (topology.hiddenDevices > 0)
    notes.push({ id: 'hidden', text: t.notes.hiddenDevices(topology.hiddenDevices), tone: 'info' });
  if (
    topology.nodes.some(node => node.type === 'ap') &&
    topology.nodes.some(node => node.type === 'lan')
  )
    notes.push({ id: 'placement', text: t.notes.placement, tone: 'info' });

  return (
    <Card>
      <View style={{ gap: theme.spacing.sm }}>
        {notes.map(note => (
          <AppText
            key={note.id}
            testID={`topology-note-${note.id}`}
            variant="body"
            color={note.tone === 'warning' ? 'warning' : 'textPrimary'}
          >
            {note.text}
          </AppText>
        ))}
        <AppText variant="caption" color="textSecondary">
          {t.legend}
        </AppText>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
