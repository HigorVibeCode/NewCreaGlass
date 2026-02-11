import { useRouter, useSegments } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { useRealtime } from '../../hooks/use-realtime';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { repos } from '../../services/container';
import { useAuth } from '../../store/auth-store';

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { session, setSession } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colors = useThemeColors();
  const [isReady, setIsReady] = useState(false);
  const isNavigatingRef = useRef(false);
  const hasNavigatedRef = useRef(false);

  // Ativar Realtime subscriptions quando o usuário estiver autenticado
  useRealtime();

  // ---- On mount: restore Supabase session (fast, from local storage) ----
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        const existingSession = await repos.authRepo.getCurrentSession();
        if (isMounted && existingSession) {
          console.log('[AuthGuard] Session restored from Supabase (fast path)');
          setSession(existingSession);
        } else {
          console.log('[AuthGuard] No existing session found');
        }
      } catch (err) {
        console.warn('[AuthGuard] Could not restore session:', err);
      }

      // Wait a frame to ensure children have time to mount
      if (isMounted) {
        // On native, give extra time for the navigation container to initialize
        const delay = Platform.OS === 'web' ? 100 : 300;
        setTimeout(() => {
          if (isMounted) setIsReady(true);
        }, delay);
      }
    };

    restoreSession();
    return () => { isMounted = false; };
  }, []); // Only once on mount

  // ---- Navigation guard ----
  useEffect(() => {
    if (!isReady) return;
    if (isNavigatingRef.current) return;
    if (!segments || segments.length === 0) return;

    const currentRoute = segments[0] || '';
    const inAuthGroup = currentRoute === 'login';

    if (!session && !inAuthGroup) {
      // No session & not on login → go to login
      navigateSafely('/login');
      return;
    }

    if (session && inAuthGroup) {
      // Has session but still on login → go to app
      navigateSafely('/(tabs)/production');
      return;
    }
  }, [session, isReady, segments]);

  /**
   * Navigate safely — prevent concurrent navigations and handle errors.
   */
  const navigateSafely = (route: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    try {
      console.log(`[AuthGuard] Navigating to ${route}`);
      router.replace(route as any);
    } catch (err) {
      console.warn('[AuthGuard] Navigation error:', err);
    }

    // Reset after navigation settles
    setTimeout(() => { isNavigatingRef.current = false; }, 800);
  };

  // Show loading only during initial session restoration
  if (!isReady) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
