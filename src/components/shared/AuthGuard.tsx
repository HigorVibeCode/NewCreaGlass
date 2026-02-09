import { useRouter, useSegments } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
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
  const isProcessingRef = useRef(false);

  // Ativar Realtime subscriptions quando o usuário estiver autenticado
  useRealtime();

  // ---- On mount: restore Supabase session (fast, from local storage) ----
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      try {
        // getCurrentSession → supabase.auth.getSession()
        // This reads from local storage first (instant), only refreshes if token expired
        const existingSession = await repos.authRepo.getCurrentSession();
        if (isMounted && existingSession) {
          console.log('[AuthGuard] Session restored from Supabase (fast path)');
          setSession(existingSession);
        }
      } catch (err) {
        console.warn('[AuthGuard] Could not restore session:', err);
      }
      if (isMounted) {
        setIsReady(true);
      }
    };

    restoreSession();
    return () => { isMounted = false; };
  }, []); // Only once on mount

  // ---- Navigation guard: redirect based on session state ----
  useEffect(() => {
    if (!isReady || isProcessingRef.current) return;
    if (!segments || segments.length === 0) return;

    const currentRoute = segments[0] || '';
    const inAuthGroup = currentRoute === 'login';

    if (!session && !inAuthGroup) {
      // No session & not on login → go to login
      isProcessingRef.current = true;
      console.log('[AuthGuard] No session, redirecting to /login');
      try { router.replace('/login'); } catch {}
      // Reset processing flag after a short delay to allow navigation to settle
      setTimeout(() => { isProcessingRef.current = false; }, 300);
      return;
    }

    if (session && inAuthGroup) {
      // Has session but still on login → go to app
      isProcessingRef.current = true;
      console.log('[AuthGuard] Session exists, redirecting to /(tabs)/production');
      try { router.replace('/(tabs)/production'); } catch {}
      setTimeout(() => { isProcessingRef.current = false; }, 300);
      return;
    }
  }, [session, isReady, segments]);

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
