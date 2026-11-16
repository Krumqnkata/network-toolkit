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
      <Circle cx={12} cy={12} r={3} />
      <Path d="M12 2.75v2.5M12 18.75v2.5M21.25 12h-2.5M5.25 12h-2.5M18.54 5.46l-1.77 1.77M7.23 16.77l-1.77 1.77M18.54 18.54l-1.77-1.77M7.23 7.23L5.46 5.46" />
    </>
  ),
  arrowDown: <Path d="M12 4.5v15M6 13.5l6 6 6-6" />,
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
