import { useRouter, useSegments } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
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
  const pendingDeepLinkRef = useRef<string | null>(null);

  // Ativar Realtime subscriptions quando o usuário estiver autenticado
  useRealtime();

  // ---- Capturar deep link inicial (NFC, notificação, etc.) ----
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        const parsed = Linking.parse(url);
        if (parsed.path && parsed.path !== '' && parsed.path !== '(tabs)/production') {
          const qs = parsed.queryString ? `?${parsed.queryString}` : '';
          pendingDeepLinkRef.current = `/${parsed.path}${qs}`;
          console.log('[AuthGuard] Pending deep link:', pendingDeepLinkRef.current);
        }
      }
    });
  }, []);

  // ---- Listener para deep links quando o app já está aberto ----
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      if (parsed.path && parsed.path !== '') {
        const qs = parsed.queryString ? `?${parsed.queryString}` : '';
        const route = `/${parsed.path}${qs}`;
        console.log('[AuthGuard] Incoming deep link:', route);
        if (session) {
          try { router.push(route as any); } catch (err) {
            console.warn('[AuthGuard] Deep link navigation error:', err);
          }
        } else {
          pendingDeepLinkRef.current = route;
        }
      }
    });
    return () => subscription.remove();
  }, [session, router]);

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
      // Has session — check for pending deep link (NFC, etc.)
      const deepLink = pendingDeepLinkRef.current;
      if (deepLink) {
        pendingDeepLinkRef.current = null;
        navigateSafely(deepLink);
      } else {
        navigateSafely('/(tabs)/production');
      }
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
