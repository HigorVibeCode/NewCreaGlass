import React from 'react';
import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useAppTheme } from '../hooks/use-app-theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { effectiveTheme } = useAppTheme();

  return (
    <NavigationThemeProvider value={effectiveTheme === 'dark' ? DarkTheme : DefaultTheme}>
      <StatusBar style={effectiveTheme === 'dark' ? 'light' : 'dark'} translucent backgroundColor="transparent" />
      {children}
    </NavigationThemeProvider>
  );
};
