import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

/**
 * The app's own line-icon set (24×24 grid, 1.75 stroke). Kept in one file so
 * the visual language stays consistent and no icon font is needed.
 */
const icons = {
  home: (
    <>
      <Path d="M4 10.5L12 4l8 6.5V20h-5.5v-5.5h-5V20H4z" />
    </>
  ),
  settings: (
    <>
      <Path d="M18.99 10.29 L21.39 10.58 L21.39 13.42 L18.99 13.71 L18.16 15.74 L19.65 17.64 L17.64 19.65 L15.74 18.16 L13.71 18.99 L13.42 21.39 L10.58 21.39 L10.29 18.99 L8.26 18.16 L6.36 19.65 L4.35 17.64 L5.84 15.74 L5.01 13.71 L2.61 13.42 L2.61 10.58 L5.01 10.29 L5.84 8.26 L4.35 6.36 L6.36 4.35 L8.26 5.84 L10.29 5.01 L10.58 2.61 L13.42 2.61 L13.71 5.01 L15.74 5.84 L17.64 4.35 L19.65 6.36 L18.16 8.26Z" />
      <Circle cx={12} cy={12} r={3} />
    </>
  ),
  search: (
    <>
      <Circle cx={10.5} cy={10.5} r={6} />
      <Path d="M15 15l5 5" />
    </>
  ),
  heart: (
    <>
      <Path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.4a4.3 4.3 0 0 1 7.5 2.4C19.5 15.4 12 20 12 20z" />
      <Path d="M7.5 12.5h2.25l1.25-2 2 4 1.25-2h2.25" />
    </>
  ),
  shield: (
    <>
      <Path d="M12 3l7.5 3v5.5c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.5V6z" />
      <Path d="M9 12l2.1 2.1L15.2 10" />
    </>
  ),
  pin: (
    <>
      <Path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" />
      <Circle cx={12} cy={10} r={2.25} />
    </>
  ),
  close: <Path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  chart: <Path d="M4 19.5h16M6 15.5l4-4.5 3 3 5-6.5" />,
  swap: <Path d="M6.5 8h12l-3.5-3.5M17.5 16h-12l3.5 3.5" />,
  map: (
    <>
      <Circle cx={12} cy={5} r={2} />
      <Circle cx={5} cy={19} r={2} />
      <Circle cx={12} cy={19} r={2} />
      <Circle cx={19} cy={19} r={2} />
      <Path d="M12 7v5M5 17v-5h14v5M12 12v5" />
    </>
  ),
  arrowDown: <Path d="M12 4.5v15M6 13.5l6 6 6-6" />,
  bluetooth: <Path d="M7 7.5l10 9-5 4.5V3l5 4.5-10 9" />,
  headphones: (
    <>
      <Path d="M4 15v-3a8 8 0 0 1 16 0v3" />
      <Path d="M4 15h3v5H5.5A1.5 1.5 0 0 1 4 18.5zM20 15h-3v5h1.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </>
  ),
  watch: (
    <>
      <Path d="M8 6.5h8v11H8z" />
      <Path d="M9.5 6.5l.5-3.5h4l.5 3.5M9.5 17.5l.5 3.5h4l.5-3.5M12 10v2.5l1.5 1" />
    </>
  ),
  keyboard: (
    <>
      <Path d="M3 7h18v10H3z" />
      <Path d="M6.5 10.5h.01M10 10.5h.01M13.5 10.5h.01M17 10.5h.01M8 14h8" />
    </>
  ),
  car: (
    <>
      <Path d="M4 16v-3.5L6.5 8h11l2.5 4.5V16z" />
      <Path d="M4 16v2.5h3V16M17 16v2.5h3V16M7.5 13h.01M16.5 13h.01" />
    </>
  ),
  tag: (
    <>
      <Circle cx={12} cy={12} r={7.5} />
      <Circle cx={12} cy={12} r={2.5} />
    </>
  ),
  check: (
    <>
      <Circle cx={12} cy={12} r={9} />
      <Path d="M8 12.5l2.75 2.75L16.5 9.5" />
    </>
  ),
  antenna: (
    <>
      <Circle cx={12} cy={10} r={1.75} />
      <Path d="M12 11.75V20M8.5 13.5a5 5 0 0 1 0-7M15.5 6.5a5 5 0 0 1 0 7M5.75 16.25a9 9 0 0 1 0-12.5M18.25 3.75a9 9 0 0 1 0 12.5" />
    </>
  ),
  arrowUp: <Path d="M12 19.5v-15M6 10.5l6-6 6 6" />,
  dashboard: (
    <>
      <Path d="M4 16a8 8 0 1 1 16 0" />
      <Path d="M12 16l4.5-4.5" />
      <Circle cx={12} cy={16} r={1.25} />
      <Path d="M4 20h16" />
    </>
  ),
  wifi: (
    <>
      <Path d="M2.5 9.5a13.5 13.5 0 0 1 19 0" />
      <Path d="M5.5 13a9 9 0 0 1 13 0" />
      <Path d="M8.75 16.5a4.6 4.6 0 0 1 6.5 0" />
      <Circle cx={12} cy={19.5} r={1.1} />
    </>
  ),
  terminal: (
    <>
      <Path d="M4 6.5l5 5-5 5" />
      <Path d="M11.5 17.5H20" />
    </>
  ),
  sliders: (
    <>
      <Path d="M4 7h9M19 7h1M4 17h3M13 17h7" />
      <Circle cx={16} cy={7} r={2.25} />
      <Circle cx={10} cy={17} r={2.25} />
    </>
  ),
  pulse: <Path d="M3 12h4l2.5-6 5 12 2.5-6h4" />,
  globe: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.4 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.4-3.5-8.5s1-5.9 3.5-8.5z" />
    </>
  ),
  route: (
    <>
      <Circle cx={6} cy={18} r={2} />
      <Circle cx={18} cy={6} r={2} />
      <Path d="M8 18h7.5a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6H16" />
    </>
  ),
  lan: (
    <>
      <Path d="M9 3.5h6v4.5H9zM3 16h6v4.5H3zM15 16h6v4.5h-6z" />
      <Path d="M12 8v4M6 16v-4h12v4" />
    </>
  ),
  plug: (
    <>
      <Path d="M9 3.5V8M15 3.5V8" />
      <Path d="M6.5 8h11v3a5.5 5.5 0 0 1-11 0z" />
      <Path d="M12 16.5v4" />
    </>
  ),
  lock: (
    <>
      <Path d="M5.5 11h13v9h-13z" />
      <Path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  document: (
    <>
      <Path d="M6 3.5h8l4 4v13H6z" />
      <Path d="M14 3.5v4h4M9 13h6M9 16.5h6" />
    </>
  ),
  gauge: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 12l4-3" />
      <Path d="M7.5 15.5h9" />
    </>
  ),
  info: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 11v5.5" />
      <Circle cx={12} cy={7.75} r={0.6} />
    </>
  ),
  chevronRight: <Path d="M9.5 6l6 6-6 6" />,
  chevronLeft: <Path d="M14.5 6l-6 6 6 6" />,
  router: (
    <>
      <Path d="M3.5 13.5h17v5h-17z" />
      <Path d="M7 16h.01M10 16h.01M16.5 13.5V9" />
      <Path d="M13.5 7a4.2 4.2 0 0 1 6 0" />
    </>
  ),
  phone: (
    <>
      <Path d="M7.5 3h9v18h-9z" />
      <Path d="M11 18h2" />
    </>
  ),
  computer: (
    <>
      <Path d="M3.5 5h17v11h-17z" />
      <Path d="M9 20h6M12 16v4" />
    </>
  ),
  printer: (
    <>
      <Path d="M7 9V3.5h10V9" />
      <Path d="M4 9h16v7h-3M7 16H4V9" />
      <Path d="M7 13.5h10V20.5H7z" />
    </>
  ),
  tv: (
    <>
      <Path d="M3 5.5h18v11H3z" />
      <Path d="M8 20.5h8" />
    </>
  ),
  speaker: (
    <>
      <Path d="M6.5 3h11v18h-11z" />
      <Circle cx={12} cy={14.5} r={3} />
      <Path d="M12 7h.01" />
    </>
  ),
  storage: (
    <>
      <Path d="M4 4.5h16v6H4zM4 13.5h16v6H4z" />
      <Path d="M7.5 7.5h.01M7.5 16.5h.01" />
    </>
  ),
  camera: (
    <>
      <Path d="M3.5 7.5h12v9h-12z" />
      <Path d="M15.5 11l5-3v8l-5-3" />
    </>
  ),
  chip: (
    <>
      <Path d="M7 7h10v10H7z" />
      <Path d="M10 3.5V7M14 3.5V7M10 17v3.5M14 17v3.5M3.5 10H7M3.5 14H7M17 10h3.5M17 14h3.5" />
    </>
  ),
  device: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 8v4.5M12 16h.01" />
    </>
  ),
} as const;

export type IconName = keyof typeof icons;

export interface IconProps {
  name: IconName;
  color: string;
  size?: number;
}

export function Icon({ name, color, size = 24 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {icons[name]}
    </Svg>
  );
}
