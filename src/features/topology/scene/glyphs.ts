/**
 * Equipment illustrations for the network map, drawn on a 64 × 64 grid from
 * plain shapes (see primitives.ts). Original artwork: generic devices, no
 * vendor designs or logos.
 */
import type { LinearGradient, Shape } from './primitives';

const BODY = 'url(#eq-body)';
const DARK = 'url(#eq-dark)';
const SCREEN = 'url(#eq-screen)';
const EDGE = '#94A3B8';
const PAPER = '#FFFFFF';
const LED_GREEN = '#34D399';
const LED_BLUE = '#60A5FA';
const GRILLE = '#64748B';

export const GLYPH_GRADIENTS: LinearGradient[] = [
  {
    id: 'eq-body',
    stops: [
      [0, '#FFFFFF'],
      [1, '#D5DCE6'],
    ],
  },
  {
    id: 'eq-dark',
    stops: [
      [0, '#475266'],
      [1, '#1F2735'],
    ],
  },
  {
    id: 'eq-screen',
    stops: [
      [0, '#6EA8FF'],
      [1, '#1D4ED8'],
    ],
  },
  {
    id: 'eq-cloud',
    stops: [
      [0, '#A5C8FF'],
      [1, '#3B82F6'],
    ],
  },
  {
    id: 'eq-car',
    stops: [
      [0, '#60A5FA'],
      [1, '#1D4ED8'],
    ],
  },
];

const shadow = (rx: number, cy = 58): Shape => ({
  t: 'ellipse',
  cx: 32,
  cy,
  rx,
  ry: 2.6,
  fill: '#000000',
  opacity: 0.22,
});

const signal = (cy: number): Shape[] => [
  { t: 'path', d: `M25 ${cy} Q32 ${cy - 7} 39 ${cy}`, stroke: LED_BLUE, strokeWidth: 1.8 },
  {
    t: 'path',
    d: `M20 ${cy - 3} Q32 ${cy - 15} 44 ${cy - 3}`,
    stroke: LED_BLUE,
    strokeWidth: 1.8,
    opacity: 0.5,
  },
];

const internet: Shape[] = [
  {
    t: 'path',
    d: 'M17 48 C8 48 5 40 9 35 C11 31 15 30 18 30 C19 21 26 16 33 17 C40 18 45 23 46 29 C52 28 58 32 58 39 C58 45 53 48 48 48 Z',
    fill: 'url(#eq-cloud)',
  },
  {
    t: 'path',
    d: 'M20 32 C21 25 27 21 33 21',
    stroke: '#FFFFFF',
    strokeWidth: 2.4,
    opacity: 0.55,
  },
  { t: 'circle', cx: 32, cy: 38, r: 6.5, stroke: '#FFFFFF', strokeWidth: 1.6, opacity: 0.85 },
  {
    t: 'path',
    d: 'M25.5 38 H38.5 M32 31.5 Q28 38 32 44.5 Q36 38 32 31.5',
    stroke: '#FFFFFF',
    strokeWidth: 1.2,
    opacity: 0.85,
  },
];

const provider: Shape[] = [
  shadow(18),
  { t: 'line', x1: 32, y1: 20, x2: 32, y2: 9, stroke: '#334155', strokeWidth: 2 },
  { t: 'circle', cx: 32, cy: 8, r: 2.2, fill: LED_BLUE },
  ...signal(10),
  { t: 'rect', x: 18, y: 22, w: 28, h: 35, r: 3, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 16, y: 19, w: 32, h: 5, r: 2, fill: DARK },
  ...[28, 36, 44].flatMap(y =>
    [22.5, 29.5, 36.5].map(
      (x): Shape => ({ t: 'rect', x, y, w: 5, h: 5, r: 1, fill: SCREEN, opacity: 0.85 }),
    ),
  ),
  { t: 'rect', x: 28.5, y: 50, w: 7, h: 7, r: 1, fill: DARK },
];

const tower: Shape[] = [
  shadow(16),
  { t: 'path', d: 'M32 13 L21 57 M32 13 L43 57', stroke: '#334155', strokeWidth: 2.6 },
  {
    t: 'path',
    d: 'M27.4 31 H36.6 M24.6 43 H39.4 M27.4 31 L39.4 43 M36.6 31 L24.6 43 M23 50 H41',
    stroke: '#334155',
    strokeWidth: 1.4,
  },
  { t: 'rect', x: 25, y: 14, w: 4.5, h: 10, r: 1.2, fill: BODY, stroke: EDGE, strokeWidth: 0.8 },
  { t: 'rect', x: 34.5, y: 14, w: 4.5, h: 10, r: 1.2, fill: BODY, stroke: EDGE, strokeWidth: 0.8 },
  { t: 'circle', cx: 32, cy: 10, r: 2.4, fill: LED_BLUE },
  ...signal(12),
];

const router: Shape[] = [
  shadow(24, 56),
  ...[14, 30, 46].map((x): Shape => ({ t: 'rect', x, y: 13, w: 4, h: 24, r: 2, fill: DARK })),
  { t: 'rect', x: 7, y: 33, w: 50, h: 18, r: 6, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 11, y: 35, w: 42, h: 3, r: 1.5, fill: '#FFFFFF', opacity: 0.8 },
  ...[
    [16, LED_GREEN],
    [22, LED_GREEN],
    [28, LED_BLUE],
    [34, LED_GREEN],
  ].map(
    ([cx, fill]): Shape => ({
      t: 'circle',
      cx: cx as number,
      cy: 44,
      r: 1.7,
      fill: fill as string,
    }),
  ),
  { t: 'rect', x: 40, y: 42.5, w: 12, h: 3, r: 1.5, fill: '#CBD5E1' },
  { t: 'rect', x: 12, y: 51, w: 6, h: 2.5, r: 1, fill: '#334155' },
  { t: 'rect', x: 46, y: 51, w: 6, h: 2.5, r: 1, fill: '#334155' },
];

const networkSwitch: Shape[] = [
  shadow(26, 50),
  { t: 'rect', x: 5, y: 24, w: 54, h: 20, r: 4, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 8, y: 26, w: 48, h: 2.5, r: 1.25, fill: '#FFFFFF', opacity: 0.8 },
  ...[10, 17, 24, 31, 38, 45].flatMap((x): Shape[] => [
    { t: 'rect', x, y: 32, w: 5.5, h: 6, r: 1, fill: DARK },
    { t: 'rect', x: x + 1, y: 39.5, w: 1.6, h: 1.4, r: 0.4, fill: LED_GREEN },
  ]),
  { t: 'circle', cx: 54, cy: 35, r: 1.4, fill: LED_BLUE },
];

const accessPoint: Shape[] = [
  ...signal(22),
  { t: 'circle', cx: 32, cy: 25, r: 1.8, fill: LED_BLUE },
  shadow(22, 52),
  { t: 'ellipse', cx: 32, cy: 41, rx: 25, ry: 9, fill: '#BAC3D0' },
  { t: 'ellipse', cx: 32, cy: 37, rx: 25, ry: 9, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'ellipse', cx: 32, cy: 37, rx: 8, ry: 2.8, stroke: LED_BLUE, strokeWidth: 2 },
];

const phone: Shape[] = [
  shadow(12),
  { t: 'rect', x: 20, y: 6, w: 24, h: 50, r: 6, fill: DARK },
  { t: 'rect', x: 22.5, y: 10, w: 19, h: 42, r: 3, fill: SCREEN },
  { t: 'rect', x: 29, y: 7.3, w: 6, h: 1.6, r: 0.8, fill: GRILLE },
  { t: 'path', d: 'M22.5 32 L41.5 19 V25 L22.5 38 Z', fill: '#FFFFFF', opacity: 0.12 },
];

const laptop: Shape[] = [
  shadow(26, 54),
  { t: 'rect', x: 12, y: 12, w: 40, h: 29, r: 3, fill: DARK },
  { t: 'rect', x: 14.5, y: 14.5, w: 35, h: 24, r: 1.5, fill: SCREEN },
  { t: 'path', d: 'M14.5 32 L49.5 18 V24 L14.5 38 Z', fill: '#FFFFFF', opacity: 0.1 },
  { t: 'path', d: 'M5 42 H59 L55 50 H9 Z', fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 27, y: 43.5, w: 10, h: 2, r: 1, fill: '#CBD5E1' },
];

const printer: Shape[] = [
  shadow(24, 57),
  { t: 'rect', x: 19, y: 9, w: 26, h: 15, r: 1.5, fill: PAPER, stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 8, y: 22, w: 48, h: 24, r: 5, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 40, y: 27, w: 11, h: 5, r: 1.5, fill: SCREEN },
  { t: 'circle', cx: 14, cy: 29.5, r: 1.6, fill: LED_GREEN },
  { t: 'rect', x: 15, y: 38, w: 34, h: 3, r: 1.5, fill: DARK },
  { t: 'rect', x: 19, y: 40, w: 26, h: 15, r: 1.5, fill: PAPER, stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 22, y: 45, w: 16, h: 1.6, r: 0.8, fill: '#CBD5E1' },
  { t: 'rect', x: 22, y: 49, w: 20, h: 1.6, r: 0.8, fill: '#CBD5E1' },
];

const tv: Shape[] = [
  shadow(18, 57),
  { t: 'rect', x: 5, y: 10, w: 54, h: 35, r: 3, fill: DARK },
  { t: 'rect', x: 7.5, y: 12.5, w: 49, h: 30, r: 1.5, fill: SCREEN },
  { t: 'path', d: 'M7.5 34 L56.5 16 V23 L7.5 41 Z', fill: '#FFFFFF', opacity: 0.1 },
  { t: 'path', d: 'M28 45 H36 L39 52 H25 Z', fill: DARK },
  { t: 'rect', x: 20, y: 51.5, w: 24, h: 3, r: 1.5, fill: DARK },
];

const speaker: Shape[] = [
  shadow(13),
  { t: 'rect', x: 20, y: 8, w: 24, h: 49, r: 11, fill: DARK },
  { t: 'ellipse', cx: 32, cy: 13, rx: 7.5, ry: 2.4, stroke: LED_BLUE, strokeWidth: 1.6 },
  ...[24, 31, 38, 45].flatMap(cy =>
    [27, 32, 37].map((cx): Shape => ({ t: 'circle', cx, cy, r: 1.3, fill: GRILLE })),
  ),
];

const nas: Shape[] = [
  shadow(18),
  { t: 'rect', x: 14, y: 7, w: 36, h: 50, r: 5, fill: DARK },
  { t: 'circle', cx: 32, cy: 11, r: 1.2, fill: LED_BLUE },
  ...[18, 34].flatMap((x): Shape[] => [
    { t: 'rect', x, y: 15, w: 12, h: 37, r: 2, fill: BODY },
    { t: 'circle', cx: x + 6, cy: 19.5, r: 1.3, fill: LED_GREEN },
    { t: 'rect', x: x + 2, y: 45, w: 8, h: 2.2, r: 1, fill: EDGE },
  ]),
];

const camera: Shape[] = [
  shadow(16, 56),
  { t: 'rect', x: 22, y: 48, w: 20, h: 5, r: 2.5, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 28.5, y: 36, w: 7, h: 13, r: 2, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 10, y: 20, w: 42, h: 19, r: 8, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 8, y: 16.5, w: 47, h: 6, r: 3, fill: DARK },
  { t: 'circle', cx: 45, cy: 29.5, r: 6, fill: DARK },
  { t: 'circle', cx: 45, cy: 29.5, r: 2.8, fill: SCREEN },
  { t: 'circle', cx: 36, cy: 29.5, r: 1.3, fill: '#F87171' },
];

const plug: Shape[] = [
  shadow(15, 57),
  { t: 'rect', x: 16, y: 12, w: 32, h: 40, r: 10, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'circle', cx: 32, cy: 19, r: 2, fill: LED_BLUE },
  { t: 'circle', cx: 26, cy: 32, r: 2.6, fill: DARK },
  { t: 'circle', cx: 38, cy: 32, r: 2.6, fill: DARK },
  { t: 'rect', x: 24, y: 43, w: 16, h: 2.6, r: 1.3, fill: LED_GREEN },
];

const generic: Shape[] = [
  shadow(19, 55),
  { t: 'rect', x: 13, y: 16, w: 38, h: 34, r: 7, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 18, y: 21, w: 28, h: 15, r: 2.5, fill: DARK },
  {
    t: 'text',
    x: 32,
    y: 33,
    text: '?',
    size: 12,
    fill: '#93C5FD',
    weight: '700',
    anchor: 'middle',
  },
  { t: 'circle', cx: 19.5, cy: 43.5, r: 1.6, fill: LED_GREEN },
  { t: 'rect', x: 33, y: 42.5, w: 12, h: 2.4, r: 1.2, fill: '#CBD5E1' },
];

const headphones: Shape[] = [
  shadow(16),
  { t: 'path', d: 'M14 38 V31 A18 18 0 0 1 50 31 V38', stroke: '#334155', strokeWidth: 4 },
  { t: 'rect', x: 8, y: 32, w: 12, h: 20, r: 5.5, fill: DARK },
  { t: 'rect', x: 44, y: 32, w: 12, h: 20, r: 5.5, fill: DARK },
  { t: 'rect', x: 17, y: 34, w: 4, h: 16, r: 2, fill: GRILLE },
  { t: 'rect', x: 43, y: 34, w: 4, h: 16, r: 2, fill: GRILLE },
];

const watch: Shape[] = [
  { t: 'rect', x: 24, y: 3, w: 16, h: 58, r: 5, fill: '#334155' },
  { t: 'rect', x: 17, y: 17, w: 30, h: 30, r: 9, fill: '#475569' },
  { t: 'rect', x: 20, y: 20, w: 24, h: 24, r: 7, fill: SCREEN },
  { t: 'rect', x: 47, y: 27, w: 3, h: 9, r: 1.5, fill: EDGE },
  {
    t: 'path',
    d: 'M26 36 L30 32 L33 35 L38 28',
    stroke: '#FFFFFF',
    strokeWidth: 1.6,
    opacity: 0.85,
  },
];

const fitness: Shape[] = [
  { t: 'rect', x: 26, y: 3, w: 12, h: 58, r: 5, fill: '#334155' },
  { t: 'rect', x: 22, y: 18, w: 20, h: 28, r: 7, fill: '#475569' },
  { t: 'rect', x: 24.5, y: 20.5, w: 15, h: 23, r: 5, fill: SCREEN },
  { t: 'path', d: 'M27 33 L30 33 L32 28 L34 37 L36 33 H38', stroke: '#FFFFFF', strokeWidth: 1.4 },
];

const mouse: Shape[] = [
  shadow(14, 57),
  { t: 'ellipse', cx: 32, cy: 34, rx: 13, ry: 20, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'line', x1: 32, y1: 14, x2: 32, y2: 30, stroke: EDGE, strokeWidth: 1 },
  { t: 'path', d: 'M19.5 30 H44.5', stroke: EDGE, strokeWidth: 1 },
  { t: 'rect', x: 30.5, y: 19, w: 3, h: 7, r: 1.5, fill: DARK },
];

const car: Shape[] = [
  shadow(26, 53),
  {
    t: 'path',
    d: 'M6 46 V37 Q6 33 10 32 L18 30 L25 21 Q27 19 31 19 H42 Q46 19 48 22 L53 30 Q58 31 58 36 V46 Z',
    fill: 'url(#eq-car)',
  },
  { t: 'path', d: 'M27 23 H36 V30 H21 Z', fill: '#DBEAFE' },
  { t: 'path', d: 'M39 23 H43 Q45 23 46 25 L49 30 H39 Z', fill: '#DBEAFE' },
  { t: 'circle', cx: 18, cy: 46, r: 6, fill: '#1F2735' },
  { t: 'circle', cx: 18, cy: 46, r: 2.5, fill: EDGE },
  { t: 'circle', cx: 46, cy: 46, r: 6, fill: '#1F2735' },
  { t: 'circle', cx: 46, cy: 46, r: 2.5, fill: EDGE },
];

const tag: Shape[] = [
  shadow(16, 56),
  { t: 'rect', x: 16, y: 14, w: 32, h: 36, r: 11, fill: BODY, stroke: EDGE, strokeWidth: 1 },
  { t: 'circle', cx: 24, cy: 22, r: 3, fill: '#E2E8F0', stroke: EDGE, strokeWidth: 1 },
  { t: 'circle', cx: 34, cy: 35, r: 6, stroke: LED_BLUE, strokeWidth: 2 },
  { t: 'circle', cx: 34, cy: 35, r: 1.8, fill: LED_BLUE },
];

const GLYPHS: Record<string, Shape[]> = {
  internet,
  provider,
  operator: tower,
  router,
  switch: networkSwitch,
  ap: accessPoint,
  phone,
  computer: laptop,
  printer,
  tv,
  speaker,
  nas,
  camera,
  iot: plug,
  headphones,
  watch,
  fitness,
  keyboard: mouse,
  car,
  tracker: tag,
  unknown: generic,
};

/** Illustration for a node kind (`router`, `phone`, `tv`, …); unknown kinds get a generic box. */
export function glyphFor(kind: string): Shape[] {
  return GLYPHS[kind] ?? generic;
}

export const GLYPH_KINDS = Object.keys(GLYPHS);
