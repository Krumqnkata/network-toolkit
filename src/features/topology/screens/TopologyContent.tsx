import { useNavigation } from '@react-navigation/native';
import React, { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import type Svg from 'react-native-svg';

import { useTheme } from '../../../app/theme';
import { AppText, Badge, Button, Card, InfoRow, SectionHeader } from '../../../components/common';
import { guessBluetoothKind } from '../../../domain/algorithms/bluetooth';
import { displayName, guessKind, modelName } from '../../../domain/algorithms/devices';
import { buildTopology, type TopoNode, type Topology } from '../../../domain/algorithms/topology';
import { formatDateTime, formatTime, useLanguage, useStrings } from '../../../i18n';
import { shareFile } from '../../../native/export';
import { useBluetoothStore } from '../../../stores/bluetoothStore';
import { useHomeStore } from '../../../stores/homeStore';
import { isLanScanning, useLanStore } from '../../../stores/lanStore';
import { useTopologyStore } from '../../../stores/topologyStore';
import { useWifiScanStore } from '../../../stores/wifiScanStore';
import { logError, toAppError, type AppError } from '../../../utils/errors';
import { ErrorNotice, FormCard } from '../../network-tools/components/ToolFrame';
import {
  TopologyMap,
  nodeTitle,
  sceneLabels,
  scenePalette,
  useNodeTitle,
} from '../components/TopologyMap';
import { SceneSvg } from '../scene/SceneSvg';
import { buildMapScene, type MapScene } from '../scene/scene';
import { sceneToSvg } from '../scene/primitives';
import { exportBaseName, formatTopologyText, topologyJson } from '../services/mapExport';
import { TRACE_TARGET, buildTopologyMap, cancelTopologyMap } from '../services/topologyScan';

/** Width of exported images, independent of the phone's screen. */
const EXPORT_WIDTH = 420;

/** Combines the map's own measurements with the LAN, Wi-Fi and Bluetooth stores. */
function useTopology(): Topology | null {
  const { snapshot, hops, gatewayRttMs } = useTopologyStore();
  const lan = useLanStore(state => state.devices);
  const networks = useWifiScanStore(state => state.result?.networks ?? null);
  const bluetooth = useBluetoothStore(state => state.devices);
  const providerName = useHomeStore(state => state.publicInfo?.provider ?? null);

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
      providerName,
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
  }, [snapshot, hops, gatewayRttMs, lan, networks, bluetooth, providerName]);
}

type ExportKind = 'png' | 'svg' | 'txt' | 'json';

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
  const [exportScene, setExportScene] = useState<MapScene | null>(null);
  const [exportError, setExportError] = useState<AppError | null>(null);
  const exportRef = useRef<Svg>(null);
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
  const ssid = snapshot?.wifi?.ssid ?? null;
  const meta = {
    title: ssid ? t.exportTitleNamed(ssid) : t.title,
    subtitle: formatDateTime(builtAt ?? Date.now(), language),
  };

  const exportMap = async (kind: ExportKind) => {
    if (!topology) return;
    setExportError(null);
    const base = exportBaseName(builtAt ?? Date.now());
    const scene = () =>
      buildMapScene(topology, {
        width: EXPORT_WIDTH,
        palette: scenePalette(theme, theme.colors.background),
        title: node => nodeTitle(node, s),
        labels: sceneLabels(s),
        header: meta,
        legend: {
          good: t.states.good,
          warn: t.states.warn,
          bad: t.states.bad,
          wireless: t.links.wireless,
          footer: t.exportFooter,
        },
      });
    try {
      if (kind === 'png') {
        // Drawn off-screen at a fixed width; the image is taken once it is laid out.
        setExportScene(scene());
        return;
      }
      if (kind === 'svg') await shareFile(`${base}.svg`, sceneToSvg(scene()), { title: t.title });
      if (kind === 'txt') {
        await shareFile(`${base}.txt`, formatTopologyText(topology, s, meta), { title: t.title });
      }
      if (kind === 'json') {
        await shareFile(
          `${base}.json`,
          topologyJson(topology, { createdAt: builtAt ?? Date.now(), ssid }),
          {
            title: t.title,
          },
        );
      }
    } catch (caught) {
      logError('topology-export', caught);
      setExportError(toAppError(caught));
    }
  };

  const capturePng = () => {
    const svg = exportRef.current as unknown as {
      toDataURL?: (callback: (base64: string) => void) => void;
    } | null;
    const scene = exportScene;
    setExportScene(null);
    if (!scene) return;
    const base = exportBaseName(builtAt ?? Date.now());
    if (!svg?.toDataURL) {
      // No raster support (e.g. tests): fall back to the vector drawing.
      shareFile(`${base}.svg`, sceneToSvg(scene), { title: t.title }).catch(caught =>
        setExportError(toAppError(caught)),
      );
      return;
    }
    svg.toDataURL(base64 => {
      shareFile(`${base}.png`, base64, { base64: true, title: t.title }).catch(caught => {
        logError('topology-export', caught);
        setExportError(toAppError(caught));
      });
    });
  };

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
              style={{ paddingVertical: theme.spacing.sm }}
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

          <SectionHeader title={t.export.title} />
          <Card>
            <AppText variant="caption" color="textSecondary">
              {t.export.hint}
            </AppText>
            <View style={[styles.row, { gap: theme.spacing.sm, marginTop: theme.spacing.md }]}>
              <Button
                testID="topology-export-png"
                label={t.export.png}
                variant="secondary"
                busy={exportScene !== null}
                onPress={() => exportMap('png')}
              />
              <Button
                testID="topology-export-svg"
                label={t.export.svg}
                variant="secondary"
                onPress={() => exportMap('svg')}
              />
              <Button
                testID="topology-export-txt"
                label={t.export.text}
                variant="secondary"
                onPress={() => exportMap('txt')}
              />
              <Button
                testID="topology-export-json"
                label={t.export.json}
                variant="secondary"
                onPress={() => exportMap('json')}
              />
            </View>
          </Card>
          {exportError ? <ErrorNotice error={exportError} /> : null}
        </>
      ) : null}

      {exportScene ? (
        <View
          pointerEvents="none"
          style={[styles.offscreen, { width: exportScene.width, height: exportScene.height }]}
          onLayout={() => setTimeout(capturePng, 50)}
        >
          <SceneSvg ref={exportRef} scene={exportScene} />
        </View>
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
      <InfoRow label={t.fields.type} value={t.types[node.type]} mono={false} />
      {node.hopRole && node.type !== 'provider' ? (
        <AppText variant="caption" color="textSecondary" style={{ marginBottom: theme.spacing.sm }}>
          {t.hopRoles[node.hopRole]}
        </AppText>
      ) : null}
      {node.address ? <InfoRow label={t.fields.address} value={node.address} /> : null}
      {node.vendor ? <InfoRow label={t.fields.vendor} value={node.vendor} mono={false} /> : null}
      {node.detail && node.type !== 'ap' ? (
        <InfoRow
          label={node.type === 'router' ? t.fields.network : t.fields.model}
          value={node.detail}
          mono={false}
        />
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
      {node.hops?.length ? (
        <View testID="topology-hops" style={{ marginTop: theme.spacing.sm }}>
          <AppText variant="caption" color="textSecondary">
            {t.fields.hops(node.hops.length)}
          </AppText>
          {node.hops.map(hop => (
            <InfoRow
              key={hop.ttl}
              label={`TTL ${hop.ttl}`}
              value={`${hop.address ?? '*'}${hop.rttMs !== null ? ` · ${ms(hop.rttMs)}` : ''}`}
            />
          ))}
        </View>
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
  if (topology.doubleNat) {
    notes.push({ id: 'double-nat', text: t.notes.doubleNat, tone: 'warning' });
  }
  if (topology.cgnat) notes.push({ id: 'cgnat', text: t.notes.cgnat, tone: 'info' });
  if (!topology.reached && topology.nodes.some(node => node.parent === 'internet')) {
    notes.push({ id: 'not-reached', text: t.notes.notReached, tone: 'warning' });
  }
  if (topology.hiddenDevices > 0) {
    notes.push({ id: 'hidden', text: t.notes.hiddenDevices(topology.hiddenDevices), tone: 'info' });
  }
  if (
    topology.nodes.some(node => node.type === 'ap') &&
    topology.nodes.some(node => node.type === 'lan')
  ) {
    notes.push({ id: 'placement', text: t.notes.placement, tone: 'info' });
  }

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
  offscreen: {
    left: -10000,
    opacity: 0,
    position: 'absolute',
    top: 0,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});
