/**
 * A tiny drawing vocabulary shared by the on-screen map (react-native-svg) and
 * the exported SVG file, so both always show exactly the same picture.
 */

export interface Paint {
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  dash?: string;
  opacity?: number;
}

export type Shape =
  | ({ t: 'rect'; x: number; y: number; w: number; h: number; r?: number } & Paint)
  | ({ t: 'circle'; cx: number; cy: number; r: number } & Paint)
  | ({ t: 'ellipse'; cx: number; cy: number; rx: number; ry: number } & Paint)
  | ({ t: 'path'; d: string } & Paint)
  | ({ t: 'line'; x1: number; y1: number; x2: number; y2: number } & Paint)
  | {
      t: 'text';
      x: number;
      y: number;
      text: string;
      size: number;
      fill: string;
      weight?: '400' | '600' | '700';
      anchor?: 'start' | 'middle' | 'end';
      mono?: boolean;
    }
  | { t: 'group'; x: number; y: number; scale?: number; children: Shape[] };

export interface LinearGradient {
  id: string;
  /** Top-to-bottom unless `horizontal`. */
  horizontal?: boolean;
  stops: [offset: number, color: string][];
}

export interface Scene {
  width: number;
  height: number;
  background: string;
  gradients: LinearGradient[];
  shapes: Shape[];
}

export const FONT_SANS = 'Inter, Roboto, Arial, sans-serif';
export const FONT_MONO = "'JetBrains Mono', 'Roboto Mono', monospace";

const escapeXml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const num = (value: number) => String(Math.round(value * 100) / 100);

function paintAttrs(paint: Paint): string {
  const parts = [
    `fill="${escapeXml(paint.fill ?? 'none')}"`,
    paint.stroke ? `stroke="${escapeXml(paint.stroke)}"` : '',
    paint.strokeWidth ? `stroke-width="${num(paint.strokeWidth)}"` : '',
    paint.dash ? `stroke-dasharray="${paint.dash}"` : '',
    paint.stroke ? 'stroke-linecap="round" stroke-linejoin="round"' : '',
    paint.opacity !== undefined ? `opacity="${num(paint.opacity)}"` : '',
  ];
  return parts.filter(Boolean).join(' ');
}

function shapeToSvg(shape: Shape): string {
  switch (shape.t) {
    case 'rect':
      return `<rect x="${num(shape.x)}" y="${num(shape.y)}" width="${num(shape.w)}" height="${num(
        shape.h,
      )}" rx="${num(shape.r ?? 0)}" ${paintAttrs(shape)}/>`;
    case 'circle':
      return `<circle cx="${num(shape.cx)}" cy="${num(shape.cy)}" r="${num(shape.r)}" ${paintAttrs(
        shape,
      )}/>`;
    case 'ellipse':
      return `<ellipse cx="${num(shape.cx)}" cy="${num(shape.cy)}" rx="${num(shape.rx)}" ry="${num(
        shape.ry,
      )}" ${paintAttrs(shape)}/>`;
    case 'path':
      return `<path d="${shape.d}" ${paintAttrs(shape)}/>`;
    case 'line':
      return `<line x1="${num(shape.x1)}" y1="${num(shape.y1)}" x2="${num(shape.x2)}" y2="${num(
        shape.y2,
      )}" ${paintAttrs(shape)}/>`;
    case 'text':
      return `<text x="${num(shape.x)}" y="${num(shape.y)}" font-size="${num(
        shape.size,
      )}" font-family="${escapeXml(shape.mono ? FONT_MONO : FONT_SANS)}" font-weight="${
        shape.weight ?? '400'
      }" text-anchor="${shape.anchor ?? 'start'}" fill="${escapeXml(shape.fill)}">${escapeXml(
        shape.text,
      )}</text>`;
    case 'group':
      return `<g transform="translate(${num(shape.x)} ${num(shape.y)})${
        shape.scale && shape.scale !== 1 ? ` scale(${num(shape.scale)})` : ''
      }">${shape.children.map(shapeToSvg).join('')}</g>`;
  }
}

/** A standalone SVG document of the scene (for export). */
export function sceneToSvg(scene: Scene): string {
  const defs = scene.gradients
    .map(
      gradient =>
        `<linearGradient id="${gradient.id}" x1="0" y1="0" x2="${
          gradient.horizontal ? 1 : 0
        }" y2="${gradient.horizontal ? 0 : 1}">${gradient.stops
          .map(([offset, color]) => `<stop offset="${num(offset)}" stop-color="${color}"/>`)
          .join('')}</linearGradient>`,
    )
    .join('');
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${num(scene.width)}" height="${num(
      scene.height,
    )}" viewBox="0 0 ${num(scene.width)} ${num(scene.height)}">`,
    `<defs>${defs}</defs>`,
    `<rect width="100%" height="100%" fill="${scene.background}"/>`,
    ...scene.shapes.map(shapeToSvg),
    '</svg>',
  ].join('\n');
}
