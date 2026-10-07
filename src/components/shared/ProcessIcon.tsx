import React from 'react';
import Svg, { Path, Ellipse, Circle } from 'react-native-svg';

// Custom line icons for production processes the icon libraries don't cover
export type ProcessIconName = 'waterjet' | 'polish' | 'drill' | 'sandblast';

// Sand grains of the sandblast cone, [x, y]
const SAND: [number, number][] = [
  [12.2, 11.2], [11.2, 12.2],
  [15, 12], [13.6, 13.6], [12, 15],
  [18.3, 12.6], [16.8, 15], [15, 16.8], [12.6, 18.3],
  [21.3, 13.4], [20, 16.4], [18.3, 18.3], [16.4, 20], [13.4, 21.3],
];

interface ProcessIconProps {
  name: ProcessIconName;
  size?: number;
  color: string;
}

export const ProcessIcon: React.FC<ProcessIconProps> = ({ name, size = 16, color }) => {
  const line = {
    fill: 'none',
    stroke: color,
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'waterjet' && (
        <>
          {/* Nozzle, straight water jet, sheet being cut */}
          <Path d="M8.5 2h7v3l-2.2 4h-2.6L8.5 5z" {...line} />
          <Path d="M12 9v9" {...line} />
          <Path d="M3 19h18v2.5H3z" {...line} />
          <Path d="M10.5 18l-2.5-2.2M13.5 18l2.5-2.2" {...line} />
        </>
      )}
      {name === 'polish' && (
        <>
          {/* Polishing head with spinning disc */}
          <Path d="M9.5 3h5v4h-5z" {...line} />
          <Path d="M12 7v6" {...line} />
          <Ellipse cx={12} cy={15.5} rx={8.5} ry={3} {...line} />
          <Path d="M2.5 20.5c2 1.3 4.5 2 9.5 2s7.5-.7 9.5-2" {...line} strokeOpacity={0.6} />
        </>
      )}
      {name === 'drill' && (
        <>
          {/* Drill bit: shank, fluted body, point */}
          <Path d="M10 2h4v5h-4z" {...line} />
          <Path d="M10 7v10l2 5 2-5V7" {...line} />
          <Path d="M10 9.5l4 2M10 13l4 2M10 16.5l3 1.5" {...line} />
        </>
      )}
      {name === 'sandblast' && (
        <>
          {/* Blasting nozzle with a cone of sand grains */}
          <Path d="M2.2 6.2L6.2 2.2L10.6 6.6L6.6 10.6Z" {...line} />
          <Path d="M8.6 8.6L10.4 10.4" {...line} />
          {SAND.map(([cx, cy], index) => (
            <Circle key={index} cx={cx} cy={cy} r={0.95} fill={color} />
          ))}
        </>
      )}
    </Svg>
  );
};
