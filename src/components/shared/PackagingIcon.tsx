import React from 'react';
import Svg, { Path, Rect, Ellipse } from 'react-native-svg';

// Custom line icons for packing types (Ionicons has no glass rack, pallet or paper roll).
// 24x24 grid, stroke-based to match the Ionicons outline style.
export type PackagingIconName = 'cardboard-box' | 'glass-rack' | 'pallet' | 'paper-roll';

interface PackagingIconProps {
  name: PackagingIconName;
  size?: number;
  color: string;
}

export const PackagingIcon: React.FC<PackagingIconProps> = ({ name, size = 16, color }) => {
  const stroke = { stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'cardboard-box' && (
        <>
          {/* Box with closed flaps and a strip of tape */}
          <Path d="M3 8l9-4 9 4v9l-9 4-9-4z" {...stroke} />
          <Path d="M3 8l9 4 9-4M12 12v9" {...stroke} />
          <Path d="M7.5 6l9 4v3" {...stroke} />
        </>
      )}
      {name === 'glass-rack' && (
        <>
          {/* A-frame stand with a glass sheet leaning on each side */}
          <Path d="M7 20.5L12 4l5 16.5M3.5 20.5h17M9 14h6" {...stroke} />
          <Path d="M3.2 17.5L8.4 3.8M20.8 17.5L15.6 3.8" {...stroke} />
        </>
      )}
      {name === 'pallet' && (
        <>
          {/* Euro pallet seen from the side: deck boards, blocks, bottom boards */}
          <Rect x={2} y={6} width={20} height={3.2} rx={0.6} {...stroke} />
          <Rect x={3} y={9.2} width={3.4} height={5} {...stroke} />
          <Rect x={10.3} y={9.2} width={3.4} height={5} {...stroke} />
          <Rect x={17.6} y={9.2} width={3.4} height={5} {...stroke} />
          <Rect x={2} y={14.2} width={20} height={3} rx={0.6} {...stroke} />
        </>
      )}
      {name === 'paper-roll' && (
        <>
          {/* Paper roll with the loose end unrolled */}
          <Path d="M7 4h10a4 6 0 0 1 0 12H7" {...stroke} />
          <Ellipse cx={7} cy={10} rx={4} ry={6} {...stroke} />
          <Ellipse cx={7} cy={10} rx={1.3} ry={2} {...stroke} />
          <Path d="M17 16v4.5H10" {...stroke} />
        </>
      )}
    </Svg>
  );
};
