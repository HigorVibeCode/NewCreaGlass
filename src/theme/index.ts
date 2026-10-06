import { Platform } from 'react-native';

export const theme = {
  colors: {
    primary: '#6366f1', // Indigo accent (Monday-style)
    primaryLight: '#818cf8',
    primaryDark: '#4f46e5',
    
    // Backgrounds
    background: '#ffffff',
    backgroundSecondary: '#f8f9fa',
    backgroundTertiary: '#f1f3f5',
    
    // Text
    text: '#1a1a1a',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',
    textInverse: '#ffffff',
    
    // Borders
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    
    // Status colors
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    info: '#3b82f6',
    
    // Cards
    cardBackground: '#ffffff',
    cardShadow: 'rgba(0, 0, 0, 0.08)',
    
    // Overlay
    overlay: 'rgba(0, 0, 0, 0.5)',
  },
  
  dark: {
    primary: '#818cf8',
    primaryLight: '#a5b4fc',
    primaryDark: '#6366f1',
    
    background: '#0f172a',
    backgroundSecondary: '#1e293b',
    backgroundTertiary: '#334155',
    
    text: '#f8fafc',
    textSecondary: '#cbd5e1',
    textTertiary: '#94a3b8',
    textInverse: '#1a1a1a',
    
    border: '#334155',
    borderLight: '#475569',
    
    success: '#34d399',
    warning: '#fbbf24',
    error: '#f87171',
    info: '#60a5fa',
    
    cardBackground: '#1e293b',
    cardShadow: 'rgba(0, 0, 0, 0.3)',
    
    overlay: 'rgba(0, 0, 0, 0.7)',
  },
  
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  
  borderRadius: {
    sm: 6,
    md: 12,
    lg: 16,
    xl: 24,
    full: 9999,
  },
  
  typography: {
    fontFamily: {
      regular: 'System',
      medium: 'System',
      bold: 'System',
    },
    fontSize: {
      xs: 12,
      sm: 14,
      md: 16,
      lg: 18,
      xl: 20,
      xxl: 24,
      xxxl: 32,
    },
    lineHeight: {
      xs: 16,
      sm: 20,
      md: 24,
      lg: 28,
      xl: 32,
      xxl: 40,
    },
    fontWeight: {
      regular: '400' as const,
      medium: '500' as const,
      semibold: '600' as const,
      bold: '700' as const,
    },
  },
  
  elevation: {
    none: 0,
    sm: 2,
    md: 4,
    lg: 8,
    xl: 16,
  },
  
  shadows: Platform.OS === 'web'
    ? {
        sm: { boxShadow: '0px 1px 2px rgba(0,0,0,0.05)' },
        md: { boxShadow: '0px 2px 4px rgba(0,0,0,0.08)' },
        lg: { boxShadow: '0px 4px 8px rgba(0,0,0,0.1)' },
      }
    : {
        sm: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.05,
          shadowRadius: 2,
          elevation: 2,
        },
        md: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.08,
          shadowRadius: 4,
          elevation: 4,
        },
        lg: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 8,
        },
      },
};

export type Theme = typeof theme;
export type ColorScheme = 'light' | 'dark';
