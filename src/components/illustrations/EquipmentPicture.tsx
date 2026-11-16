import React from 'react';
import Svg from 'react-native-svg';

import { GLYPH_GRADIENTS, glyphFor } from '../../features/topology/scene/glyphs';
import { GradientDefs, renderShape } from '../../features/topology/scene/SceneSvg';

/**
 * Picture of a piece of network equipment (`router`, `phone`, `provider`,
 * `internet`, `tv`, …), the same artwork as on the network map.
 */
export function EquipmentPicture({ kind, size = 56 }: { kind: string; size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <GradientDefs gradients={GLYPH_GRADIENTS} />
      {glyphFor(kind).map((shape, index) => renderShape(shape, String(index)))}
    </Svg>
  );
}
