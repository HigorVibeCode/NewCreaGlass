import React from 'react';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { getStatusAppearance } from '../../utils/production-status';
import { PackagingIcon } from './PackagingIcon';
import { ProcessIcon } from './ProcessIcon';

interface StatusIconProps {
  status: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

// Phase icon: activity drawing in the kind color; waiting phases get a small clock badge
export const StatusIcon: React.FC<StatusIconProps> = ({ status, size = 16, color, style }) => {
  const colors = useThemeColors();
  const appearance = getStatusAppearance(status, colors);
  const iconColor = color || appearance.color;
  const glyph = appearance.glyph;
  // Leave room for the clock so it doesn't cover the drawing
  const glyphSize = appearance.waiting ? Math.round(size * 0.86) : size;

  let icon: React.ReactNode;
  if (!glyph) {
    icon = <Ionicons name={appearance.icon} size={glyphSize} color={iconColor} />;
  } else if (glyph.type === 'mdi') {
    icon = <MaterialCommunityIcons name={glyph.name} size={glyphSize} color={iconColor} />;
  } else if (glyph.type === 'packaging') {
    icon = <PackagingIcon name={glyph.name} size={glyphSize} color={iconColor} />;
  } else {
    icon = <ProcessIcon name={glyph.name} size={glyphSize} color={iconColor} />;
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      {icon}
      {appearance.waiting && glyph && (
        <MaterialCommunityIcons
          name="clock-time-four"
          size={Math.round(size * 0.55)}
          color={iconColor}
          style={styles.clock}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  clock: {
    position: 'absolute',
    right: -1,
    bottom: -1,
  },
});
