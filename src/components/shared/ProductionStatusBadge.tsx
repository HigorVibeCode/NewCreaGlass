import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../theme';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { useI18n } from '../../hooks/use-i18n';
import { getStatusAppearance, getStatusLabel } from '../../utils/production-status';
import { StatusIcon } from './StatusIcon';

interface ProductionStatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  trailing?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const ProductionStatusBadge: React.FC<ProductionStatusBadgeProps> = ({ status, size = 'sm', trailing, style }) => {
  const { t } = useI18n();
  const colors = useThemeColors();
  const { color } = getStatusAppearance(status, colors);
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, isSmall ? styles.badgeSm : styles.badgeMd, { backgroundColor: color + '1A' }, style]}>
      <StatusIcon status={status} size={isSmall ? 13 : 16} color={color} />
      <Text
        style={[styles.text, { color, fontSize: isSmall ? theme.typography.fontSize.xs : theme.typography.fontSize.sm }]}
        numberOfLines={1}
      >
        {getStatusLabel(t, status)}
      </Text>
      {trailing}
    </View>
  );
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.borderRadius.sm,
    gap: 4,
    flexShrink: 1,
  },
  badgeSm: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: 3,
  },
  badgeMd: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
  },
  text: {
    flexShrink: 1,
    fontWeight: theme.typography.fontWeight.semibold,
  },
});
