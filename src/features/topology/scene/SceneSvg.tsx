import React, { forwardRef } from 'react';
import Svg, {
  Circle,
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

import type { Paint, Scene, Shape } from './primitives';

const paint = (shape: Paint) => ({
  fill: shape.fill ?? 'none',
  stroke: shape.stroke,
  strokeWidth: shape.strokeWidth,
  strokeDasharray: shape.dash,
  strokeLinecap: shape.stroke ? ('round' as const) : undefined,
  strokeLinejoin: shape.stroke ? ('round' as const) : undefined,
  opacity: shape.opacity,
});

/** On-device fonts registered in MainApplication (`Inter`, `JetBrains Mono`). */
const family = (mono?: boolean) => (mono ? 'JetBrains Mono' : 'Inter');

export function renderShape(shape: Shape, key: string): React.ReactNode {
  switch (shape.t) {
    case 'rect':
      return (
        <Rect
          key={key}
          x={shape.x}
          y={shape.y}
          width={shape.w}
          height={shape.h}
          rx={shape.r}
          {...paint(shape)}
        />
      );
    case 'circle':
      return <Circle key={key} cx={shape.cx} cy={shape.cy} r={shape.r} {...paint(shape)} />;
    case 'ellipse':
      return (
        <Ellipse
          key={key}
          cx={shape.cx}
          cy={shape.cy}
          rx={shape.rx}
          ry={shape.ry}
          {...paint(shape)}
        />
      );
    case 'path':
      return <Path key={key} d={shape.d} {...paint(shape)} />;
    case 'line':
      return (
        <Line key={key} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...paint(shape)} />
      );
    case 'text':
      return (
        <SvgText
          key={key}
          x={shape.x}
          y={shape.y}
          fontSize={shape.size}
          fontWeight={shape.weight ?? '400'}
          fontFamily={family(shape.mono)}
          textAnchor={shape.anchor ?? 'start'}
          fill={shape.fill}
        >
          {shape.text}
        </SvgText>
      );
    case 'group':
      return (
        <G key={key} transform={`translate(${shape.x} ${shape.y}) scale(${shape.scale ?? 1})`}>
          {shape.children.map((child, index) => renderShape(child, `${key}.${index}`))}
        </G>
      );
  }
}

/** `<Defs>` with the scene's linear gradients. */
export function GradientDefs({ gradients }: { gradients: Scene['gradients'] }) {
  return (
    <Defs>
      {gradients.map(gradient => (
        <LinearGradient
          key={gradient.id}
          id={gradient.id}
          x1="0"
          y1="0"
          x2={gradient.horizontal ? '1' : '0'}
          y2={gradient.horizontal ? '0' : '1'}
        >
          {gradient.stops.map(([offset, color]) => (
            <Stop key={offset} offset={offset} stopColor={color} />
          ))}
        </LinearGradient>
      ))}
    </Defs>
  );
}

/** Draws a scene with react-native-svg. The ref exposes `toDataURL` for PNG export. */
export const SceneSvg = forwardRef<Svg, { scene: Scene; testID?: string }>(function SceneSvgView(
  { scene, testID },
  ref,
) {
  return (
    <Svg ref={ref} testID={testID} width={scene.width} height={scene.height}>
      <GradientDefs gradients={scene.gradients} />
      <Rect x={0} y={0} width={scene.width} height={scene.height} fill={scene.background} />
      {scene.shapes.map((shape, index) => renderShape(shape, String(index)))}
    </Svg>
  );
});
