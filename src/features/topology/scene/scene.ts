/**
 * Lays out a topology and draws it as a scene of plain shapes:
 *
 *            ☁  Internet
 *            │  +4 ms
 *            🏢 Provider
 *            │
 *       ┌────📶 Router
 *       │   ┌┴───────┐
 *       │   AP      AP           (mesh only)
 *       │   ┊
 *       │   📱 This phone ┄┄ Bluetooth devices
 *       │
 *       └─┬─────┬─────┬          LAN devices hang off a trunk at the left edge,
 *         🖥     🖨     📺         so no line ever crosses a label.
 */
import type { LinkState, TopoLink, TopoNode, Topology } from '../../../domain/algorithms/topology';
import { GLYPH_GRADIENTS, glyphFor } from './glyphs';
import type { Scene, Shape } from './primitives';

export interface ScenePalette {
  background: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  line: string;
  states: Record<LinkState, string>;
}

export interface SceneOptions {
  width: number;
  palette: ScenePalette;
  /** Name shown under a node. */
  title: (node: TopoNode) => string;
  selected?: string | null;
  labels: {
    devices: (count: number) => string;
    bluetooth: string;
    ms: (ms: number) => string;
    noAnswer: string;
  };
  /** Export only: a title band at the top and a legend at the bottom. */
  header?: { title: string; subtitle: string };
  legend?: { good: string; warn: string; bad: string; wireless: string; footer: string };
}

export interface Hit {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MapScene extends Scene {
  hits: Hit[];
}

export const GLYPH = 52;
const CELL = 86;
const LABEL_GAP = 4;
const LINE_HEIGHT = 13;
const LINK_GAP = 34;
const ROW_GAP = 22;
const TRUNK_X = 12;
const LEFT = 30;
const MAX_CHARS = 13;

const DASH: Record<TopoLink, string | undefined> = {
  path: undefined,
  wired: undefined,
  lan: undefined,
  wireless: '5 5',
  mesh: '5 5',
  cellular: '5 5',
  bluetooth: '1.5 4.5',
};

/** Splits a label into at most two lines of `max` characters, with an ellipsis if cut. */
export function wrapLabel(text: string, max = MAX_CHARS): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= max) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word;
    if (lines.length === 1) break;
  }
  if (current && lines.length < 2) lines.push(current);
  const used = lines.join(' ').length;
  if (used < text.trim().length || lines.some(line => line.length > max)) {
    const last = lines.length - 1;
    const line = lines[last] ?? '';
    lines[last] = line.length >= max ? `${line.slice(0, max - 1)}…` : `${line}…`;
  }
  return lines.slice(0, 2).map(line => (line.length > max ? `${line.slice(0, max - 1)}…` : line));
}

interface Placed {
  node: TopoNode;
  /** Centre of the glyph. */
  x: number;
  y: number;
  /** Bottom of the label block. */
  bottom: number;
}

export function buildMapScene(topology: Topology, options: SceneOptions): MapScene {
  const { width, palette } = options;
  const shapes: Shape[] = [];
  const lines: Shape[] = [];
  const hits: Hit[] = [];
  const placed = new Map<string, Placed>();
  const byId = new Map(topology.nodes.map(node => [node.id, node]));
  const children = (id: string, type?: TopoNode['type']) =>
    topology.nodes.filter(node => node.parent === id && (!type || node.type === type));

  let y = 16;
  if (options.header) {
    shapes.push(
      {
        t: 'text',
        x: 16,
        y: 26,
        text: options.header.title,
        size: 17,
        weight: '700',
        fill: palette.text,
      },
      {
        t: 'text',
        x: 16,
        y: 44,
        text: options.header.subtitle,
        size: 11,
        fill: palette.textSecondary,
      },
    );
    y = 64;
  }

  const lineColor = (node: TopoNode) =>
    node.linkState === 'unknown' ? palette.line : palette.states[node.linkState];

  const drawNode = (node: TopoNode, x: number, top: number): Placed => {
    const cy = top + GLYPH / 2;
    const selected = options.selected === node.id;
    if (selected || node.type === 'self' || node.connected) {
      shapes.push({
        t: 'rect',
        x: x - GLYPH / 2 - 6,
        y: top - 6,
        w: GLYPH + 12,
        h: GLYPH + 12,
        r: 14,
        fill: palette.accent,
        opacity: selected ? 0.18 : 0.08,
        stroke: selected ? palette.accent : undefined,
        strokeWidth: selected ? 1.5 : undefined,
      });
    }
    shapes.push({
      t: 'group',
      x: x - GLYPH / 2,
      y: top,
      scale: GLYPH / 64,
      children: glyphFor(node.kind),
    });
    let textY = top + GLYPH + LABEL_GAP + 10;
    for (const line of wrapLabel(options.title(node))) {
      shapes.push({
        t: 'text',
        x,
        y: textY,
        text: line,
        size: 11,
        weight: '600',
        anchor: 'middle',
        fill: palette.text,
      });
      textY += LINE_HEIGHT;
    }
    const sub = node.type === 'ap' ? node.detail : node.type === 'bluetooth' ? null : node.address;
    if (sub) {
      shapes.push({
        t: 'text',
        x,
        y: textY - 1,
        text: sub.length > 16 ? `${sub.slice(0, 15)}…` : sub,
        size: 9.5,
        anchor: 'middle',
        mono: node.type !== 'ap',
        fill: palette.textSecondary,
      });
      textY += LINE_HEIGHT - 1;
    }
    const result = { node, x, y: cy, bottom: textY - LINE_HEIGHT + 4 };
    placed.set(node.id, result);
    hits.push({ id: node.id, x: x - CELL / 2, y: top - 6, w: CELL, h: result.bottom - top + 10 });
    return result;
  };

  const linkLabel = (node: TopoNode, x: number, midY: number) => {
    const text =
      node.parent === 'internet' && !topology.reached
        ? options.labels.noAnswer
        : node.linkMs !== null
        ? options.labels.ms(node.linkMs)
        : null;
    if (!text) return;
    shapes.push({
      t: 'text',
      x: x + 10,
      y: midY + 4,
      text,
      size: 10,
      weight: '600',
      fill: node.linkState === 'unknown' ? palette.textMuted : palette.states[node.linkState],
    });
  };

  const center = width / 2;

  // Backbone: internet → provider → home routers → router/operator.
  const backbone: TopoNode[] = [];
  let current = byId.get('internet');
  while (current) {
    backbone.push(current);
    current = topology.nodes.find(
      node =>
        node.parent === backbone[backbone.length - 1]!.id &&
        (node.type === 'provider' ||
          node.type === 'hop' ||
          node.type === 'router' ||
          node.type === 'operator'),
    );
  }
  let previous: Placed | null = null;
  for (const node of backbone) {
    if (previous) y += LINK_GAP;
    const here = drawNode(node, center, y);
    if (previous) {
      lines.push({
        t: 'line',
        x1: center,
        y1: previous.bottom + 4,
        x2: center,
        y2: here.y - GLYPH / 2 - 4,
        stroke: lineColor(node),
        strokeWidth: 2.5,
        dash: DASH[node.link ?? 'path'],
      });
      linkLabel(node, center, (previous.bottom + here.y - GLYPH / 2) / 2);
    }
    previous = here;
    y = here.bottom;
  }
  const local = previous;
  if (!local)
    return {
      width,
      height: y,
      background: palette.background,
      gradients: GLYPH_GRADIENTS,
      shapes,
      hits,
    };

  // Access points (mesh): a bus under the router.
  const aps = children(local.node.id, 'ap');
  if (aps.length) {
    y += LINK_GAP;
    const busY = y - 14;
    const step = Math.min(CELL + 8, (width - LEFT - 8) / aps.length);
    const startX = center - (step * (aps.length - 1)) / 2;
    lines.push({
      t: 'line',
      x1: center,
      y1: local.bottom + 4,
      x2: center,
      y2: busY,
      stroke: palette.line,
      strokeWidth: 2,
      dash: DASH.mesh,
    });
    lines.push({
      t: 'line',
      x1: startX,
      y1: busY,
      x2: startX + step * (aps.length - 1),
      y2: busY,
      stroke: palette.line,
      strokeWidth: 2,
      dash: DASH.mesh,
    });
    let bottom = y;
    aps.forEach((ap, index) => {
      const x = startX + step * index;
      lines.push({
        t: 'line',
        x1: x,
        y1: busY,
        x2: x,
        y2: y - 6,
        stroke: palette.line,
        strokeWidth: 2,
        dash: DASH.mesh,
      });
      bottom = Math.max(bottom, drawNode(ap, x, y).bottom);
    });
    y = bottom;
  }

  // This phone, under its access point (or the router / operator).
  const self = byId.get('self');
  if (self) {
    const parent = placed.get(self.parent ?? '') ?? local;
    y += LINK_GAP;
    const here = drawNode(self, parent.x, y);
    lines.push({
      t: 'line',
      x1: parent.x,
      y1: parent.bottom + 4,
      x2: parent.x,
      y2: here.y - GLYPH / 2 - 4,
      stroke: lineColor(self),
      strokeWidth: 2.5,
      dash: DASH[self.link ?? 'wired'],
    });
    linkLabel(self, parent.x, (parent.bottom + here.y - GLYPH / 2) / 2);
    y = here.bottom;

    // Bluetooth devices near the phone, on a dotted bus.
    const nearby = children('self', 'bluetooth');
    if (nearby.length) {
      y += ROW_GAP;
      shapes.push({
        t: 'text',
        x: LEFT,
        y: y + 4,
        text: options.labels.bluetooth,
        size: 10,
        weight: '600',
        fill: palette.textMuted,
      });
      y += 26;
      y = drawRow(nearby, here, y, DASH.bluetooth, palette.line, false);
    }
  }

  // LAN devices: trunk from the router down the left edge, one bus per row.
  const devices = children(local.node.id, 'lan');
  if (devices.length) {
    y += ROW_GAP;
    shapes.push({
      t: 'text',
      x: LEFT,
      y: y + 4,
      text: options.labels.devices(devices.length),
      size: 10,
      weight: '600',
      fill: palette.textMuted,
    });
    y += 26;
    lines.push({
      t: 'line',
      x1: local.x - GLYPH / 2 - 2,
      y1: local.y + 6,
      x2: TRUNK_X,
      y2: local.y + 6,
      stroke: palette.line,
      strokeWidth: 2,
    });
    const end = drawRow(devices, null, y, undefined, palette.line, true);
    y = end;
  }

  function drawRow(
    items: TopoNode[],
    from: Placed | null,
    top: number,
    dash: string | undefined,
    color: string,
    trunk: boolean,
  ): number {
    const perRow = Math.max(2, Math.floor((width - LEFT - 4) / CELL));
    let rowTop = top;
    let lastBusY = top;
    for (let start = 0; start < items.length; start += perRow) {
      const row = items.slice(start, start + perRow);
      const busY = rowTop - 12;
      // Rows are centred in the space right of the trunk.
      const offset = Math.max(0, (width - LEFT - 4 - perRow * CELL) / 2);
      const xs = row.map((_, index) => LEFT + offset + CELL / 2 + index * CELL);
      const firstX = trunk ? TRUNK_X : Math.min(xs[0]!, from?.x ?? xs[0]!);
      const lastX = Math.max(xs[xs.length - 1]!, from?.x ?? 0);
      lines.push({
        t: 'line',
        x1: firstX,
        y1: busY,
        x2: lastX,
        y2: busY,
        stroke: color,
        strokeWidth: trunk ? 2 : 1.5,
        dash,
      });
      if (from && start === 0) {
        lines.push({
          t: 'line',
          x1: from.x,
          y1: from.bottom + 4,
          x2: from.x,
          y2: busY,
          stroke: color,
          strokeWidth: 1.5,
          dash,
        });
      }
      let bottom = rowTop;
      row.forEach((node, index) => {
        const x = xs[index]!;
        lines.push({
          t: 'line',
          x1: x,
          y1: busY,
          x2: x,
          y2: rowTop - 6,
          stroke: trunk ? lineColor(node) : color,
          strokeWidth: trunk ? 2 : 1.5,
          dash,
        });
        bottom = Math.max(bottom, drawNode(node, x, rowTop).bottom);
      });
      lastBusY = busY;
      rowTop = bottom + ROW_GAP + 12;
    }
    if (trunk) {
      lines.push({
        t: 'line',
        x1: TRUNK_X,
        y1: (placed.get('router')?.y ?? top) + 6,
        x2: TRUNK_X,
        y2: lastBusY,
        stroke: color,
        strokeWidth: 2,
      });
    }
    return rowTop - ROW_GAP - 12;
  }

  if (options.legend) {
    y += 28;
    const items: [string, string, string | undefined][] = [
      [options.legend.good, palette.states.good, undefined],
      [options.legend.warn, palette.states.warn, undefined],
      [options.legend.bad, palette.states.bad, undefined],
      [options.legend.wireless, palette.line, '5 5'],
    ];
    let x = 16;
    for (const [label, color, dash] of items) {
      lines.push({
        t: 'line',
        x1: x,
        y1: y,
        x2: x + 22,
        y2: y,
        stroke: color,
        strokeWidth: 2.5,
        dash,
      });
      shapes.push({
        t: 'text',
        x: x + 28,
        y: y + 4,
        text: label,
        size: 10,
        fill: palette.textSecondary,
      });
      x += 32 + label.length * 5.6;
    }
    y += 24;
    shapes.push({
      t: 'text',
      x: 16,
      y,
      text: options.legend.footer,
      size: 9.5,
      fill: palette.textMuted,
    });
  }

  return {
    width,
    height: Math.ceil(y + 16),
    background: palette.background,
    gradients: GLYPH_GRADIENTS,
    // Lines first, so equipment and labels are drawn over them.
    shapes: [...lines, ...shapes],
    hits,
  };
}
