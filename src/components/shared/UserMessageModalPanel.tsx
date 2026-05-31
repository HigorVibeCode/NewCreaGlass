import React from 'react';
import { View, Pressable, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { theme } from '../../theme';

const PANEL_ELEVATION = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
  },
  android: { elevation: 12 },
  default: {},
});

/** Corpo útil dentro do painel (lista ou scroll ocupam bem o retângulo). */
export const userMessageModalPanelInner = StyleSheet.create({
  inner: {
    flex: 1,
    minHeight: 0,
  },
});

export interface UserMessageModalPanelProps {
  children: React.ReactNode;
  onClose: () => void;
  /** Acessibilidade do toque no escuro atrás da caixa. */
  backdropAccessibilityLabel?: string;
}

/**
 * Mesmo painel centrado para caixa + detalhe + composição (largura/altura máximas alinhadas).
 */
export function UserMessageModalPanel({
  children,
  onClose,
  backdropAccessibilityLabel = 'Close',
}: UserMessageModalPanelProps) {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { width: windowW, height: windowH } = useWindowDimensions();

  const panelWidth = Math.min(520, windowW - theme.spacing.md * 2);
  const panelHeight = Math.min(
    windowH - (insets.top + insets.bottom) - theme.spacing.lg,
    Math.round(windowH * 0.9)
  );

  return (
    <View style={styles.overlayRoot}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backdropAccessibilityLabel}
        style={[styles.backdrop, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      />

      <View
        style={[
          styles.panelSlot,
          { paddingTop: insets.top + theme.spacing.sm, paddingBottom: insets.bottom + theme.spacing.sm },
        ]}
        pointerEvents="box-none"
      >
        <View
          style={[
            styles.panel,
            PANEL_ELEVATION,
            {
              width: panelWidth,
              height: panelHeight,
              backgroundColor: colors.background,
              borderColor: colors.border,
              ...(Platform.OS === 'web' ? { boxShadow: '0 12px 40px rgba(0,0,0,0.18)' as const } : {}),
            },
          ]}
        >
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: {
    flex: 1,
  },
  backdrop: StyleSheet.absoluteFillObject,
  panelSlot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
  },
  panel: {
    overflow: 'hidden',
    borderRadius: theme.borderRadius.lg,
    borderWidth: Platform.OS === 'web' ? 1 : StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
});
