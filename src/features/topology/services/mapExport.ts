import type { TopoNode, Topology } from '../../../domain/algorithms/topology';
import type { Strings } from '../../../i18n';
import { nodeTitle } from '../components/TopologyMap';

/** `network-map-2026-11-16-2011` (local time), the base name of exported files. */
export function exportBaseName(at: number): string {
  const date = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `network-map-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}-${pad(date.getHours())}${pad(date.getMinutes())}`;
}

const ms = (value: number | null) => (value === null ? '—' : `${Math.round(value)} ms`);

/** Plain-text description of the map, grouped like the drawing. */
export function formatTopologyText(
  topology: Topology,
  s: Strings,
  meta: { title: string; subtitle: string },
): string {
  const t = s.topology;
  const describe = (node: TopoNode, indent = '') => {
    const parts = [
      nodeTitle(node, s),
      node.address,
      node.detail && node.type !== 'router' ? node.detail : null,
      node.rttMs !== null ? ms(node.rttMs) : null,
    ].filter(Boolean);
    const link =
      node.link && node.linkMs !== null && node.link !== 'lan'
        ? ` (${t.links[node.link]} +${ms(node.linkMs)}, ${t.states[node.linkState]})`
        : '';
    return `${indent}${parts.join(' · ')}${link}`;
  };
  const of = (type: TopoNode['type']) => topology.nodes.filter(node => node.type === type);
  const lines: string[] = [meta.title, meta.subtitle, ''];

  lines.push(`${t.sections.path}:`);
  for (const node of topology.nodes) {
    if (!['internet', 'provider', 'hop', 'operator', 'router'].includes(node.type)) continue;
    lines.push(describe(node, '  '));
    for (const hop of node.hops ?? []) {
      lines.push(
        `      TTL ${hop.ttl}: ${hop.address ?? '*'}${
          hop.rttMs !== null ? ` · ${ms(hop.rttMs)}` : ''
        }`,
      );
    }
  }
  const aps = of('ap');
  if (aps.length) {
    lines.push('', `${t.sections.accessPoints}:`);
    for (const ap of aps)
      lines.push(describe(ap, '  ') + (ap.connected ? ` [${t.connected}]` : ''));
  }
  const self = of('self')[0];
  if (self) lines.push('', `${t.types.self}:`, describe(self, '  '));
  const devices = of('lan');
  if (devices.length) {
    lines.push('', `${t.devicesGroup(devices.length)}:`);
    for (const device of devices) lines.push(describe(device, '  '));
  }
  const bluetooth = of('bluetooth');
  if (bluetooth.length) {
    lines.push('', `${t.bluetoothGroup}:`);
    for (const device of bluetooth) {
      lines.push(
        `  ${nodeTitle(device, s)} · ${device.address}${
          device.signalDbm != null ? ` · ${device.signalDbm} dBm` : ''
        }`,
      );
    }
  }
  const notes = [
    topology.doubleNat ? t.notes.doubleNat : null,
    topology.cgnat ? t.notes.cgnat : null,
    !topology.reached ? t.notes.notReached : null,
  ].filter(Boolean);
  if (notes.length) lines.push('', ...notes.map(note => `! ${note}`));
  lines.push('', 'Network Toolkit');
  return lines.join('\n');
}

/** Machine-readable map: every node with its link and measurements. */
export function topologyJson(topology: Topology, meta: { createdAt: number; ssid: string | null }) {
  return JSON.stringify(
    {
      app: 'Network Toolkit',
      createdAt: new Date(meta.createdAt).toISOString(),
      ssid: meta.ssid,
      doubleNat: topology.doubleNat,
      cgnat: topology.cgnat,
      internetReached: topology.reached,
      nodes: topology.nodes,
    },
    null,
    2,
  );
}
