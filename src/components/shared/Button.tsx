import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, StyleProp } from 'react-native';
import { theme } from '../../theme';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
}) => {
  const colors = useThemeColors();
  
  const buttonStyle: ViewStyle[] = [styles.button];
  const textStyle: TextStyle[] = [styles.text];

  if (variant === 'primary') {
    buttonStyle.push({ backgroundColor: colors.primary });
    textStyle.push({ color: colors.textInverse });
  } else if (variant === 'secondary') {
    buttonStyle.push({ backgroundColor: colors.backgroundSecondary });
    textStyle.push({ color: colors.text });
  } else if (variant === 'outline') {
    buttonStyle.push({ backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary });
    textStyle.push({ color: colors.primary });
  }

  if (disabled || loading) {
    buttonStyle.push(styles.disabled);
  }

  return (
    <TouchableOpacity
      style={[buttonStyle, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' ? colors.textInverse : colors.primary} />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: {
    fontSize: theme.typography.fontSize.md,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  disabled: {
    opacity: 0.5,
  },
});
