import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemeColors } from '../../hooks/use-theme-colors';

interface ScreenWrapperProps {
  children: React.ReactNode;
  showTopBar?: boolean;
  maxWidth?: number; // Max width in pixels for web (default: 1400)
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({ 
  children, 
  showTopBar = true,
  maxWidth = 1400,
}) => {
  const colors = useThemeColors();
  
  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: colors.background }]} 
      edges={['top']}
    >
      <View style={[
        styles.content,
        Platform.OS === 'web' && {
          maxWidth: maxWidth,
          width: '100%',
          alignSelf: 'center',
        },
      ]}>
        {children}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      alignItems: 'center',
    }),
  },
  content: {
    flex: 1,
    ...(Platform.OS === 'web' && {
      paddingHorizontal: 24,
    }),
  },
});
