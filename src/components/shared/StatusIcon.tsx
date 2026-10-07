import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleProp, View, ViewStyle } from 'react-native';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { getStatusAppearance } from '../../utils/production-status';
import { PackagingIcon } from './PackagingIcon';

interface StatusIconProps {
  status: string;
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

// Phase icon: packing type drawing for packing phases, otherwise the kind icon
export const StatusIcon: React.FC<StatusIconProps> = ({ status, size = 16, color, style }) => {
  const colors = useThemeColors();
  const appearance = getStatusAppearance(status, colors);
  const iconColor = color || appearance.color;
  if (appearance.packaging) {
    return (
      <View style={style}>
        <PackagingIcon name={appearance.packaging} size={size} color={iconColor} />
      </View>
    );
  }
  return <Ionicons name={appearance.icon} size={size} color={iconColor} style={style as any} />;
};
