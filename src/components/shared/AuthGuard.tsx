import { useRouter, useSegments } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import * as Linking from 'expo-linking';
import { useRealtime } from '../../hooks/use-realtime';
import { useThemeColors } from '../../hooks/use-theme-colors';
import { repos } from '../../services/container';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../store/auth-store';
import { getCachedUserProfile, getCachedUserProfileAsync } from '../../store/auth-store';

const SESSION_RESTORE_TIMEOUT_MS = 10000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) =>
      setTimeout(() => {
        console.warn(`[AuthGuard] ${label} timed out after ${ms}ms`);
        resolve(null);
      }, ms),
    ),
  ]);
}

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  'use no memo';
  const { session, setSession } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const colors = useThemeColors();
  const [isReady, setIsReady] = useState(false);
  const isNavigatingRef = useRef(false);
  const hasNavigatedRef = useRef(false);
  const pendingDeepLinkRef = useRef<string | null>(null);
  const sessionRef = useRef(session);
  sessionRef.current = session;

  // Web-only: prevent login screen flash during redirect to production
  const [webRouteResolved, setWebRouteResolved] = useState(Platform.OS !== 'web');

  useRealtime();

  // ---- Capturar deep link inicial (NFC, notificação, etc.) ----
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        const parsed = Linking.parse(url);
        if (parsed.path && parsed.path !== '' && parsed.path !== '(tabs)/production') {
          let qs = '';
          if (parsed.queryParams && typeof parsed.queryParams === 'object') {
            const entries = Object.entries(parsed.queryParams).filter(
              ([, v]) => v !== undefined && v !== null,
            );
            if (entries.length > 0) {
              qs = '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
            }
          }
          pendingDeepLinkRef.current = `/${parsed.path}${qs}`;
          console.log('[AuthGuard] Pending deep link:', pendingDeepLinkRef.current);
        }
      }
    });
  }, []);

  // ---- Listener para deep links quando o app já está aberto (native only) ----
  // On web, every internal router.push() fires a URL change event, which would
  // be picked up by this listener and re-pushed, causing an infinite loop.
  // Web doesn't need this: the router already handles URL-based navigation.
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (!url) return;
      const parsed = Linking.parse(url);
      if (parsed.path && parsed.path !== '') {
        const qs = parsed.queryString ? `?${parsed.queryString}` : '';
        const route = `/${parsed.path}${qs}`;
        console.log('[AuthGuard] Incoming deep link:', route);
        if (sessionRef.current) {
          try { router.push(route as any); } catch (err) {
            console.warn('[AuthGuard] Deep link navigation error:', err);
          }
        } else {
          pendingDeepLinkRef.current = route;
        }
      }
    });
    return () => {
      try {
        if (subscription && typeof subscription.remove === 'function') {
          subscription.remove();
        }
      } catch (e) {
        console.warn('[AuthGuard] Deep link cleanup error:', e);
      }
    };
  }, [router]);

  // ---- On mount: restore session (2-phase: cache → validate) ----
  useEffect(() => {
    let isMounted = true;

    const restoreSession = async () => {
      // Phase 1: instant restore from Supabase local cache + user profile cache
      let restoredFromCache = false;
      try {
        const getSessionResult = await supabase.auth.getSession();
        const supaSession = getSessionResult?.data?.session;
        if (supaSession && isMounted) {
          const cachedUser = Platform.OS === 'web'
            ? getCachedUserProfile()
            : await getCachedUserProfileAsync();

          if (cachedUser && cachedUser.id === supaSession.user.id) {
            console.log('[AuthGuard] Session restored from cache (instant)');
            setSession({ user: cachedUser, token: supaSession.access_token });
            restoredFromCache = true;
          }
        }
      } catch (err) {
        console.warn('[AuthGuard] Cache restore failed:', err);
      }

      // Mark ready immediately if cache hit (user sees app now)
      if (restoredFromCache && isMounted) {
        setIsReady(true);

        // Phase 2 (background): validate and refresh user profile from DB
        try {
          const freshSession = await withTimeout(
            repos.authRepo.getCurrentSession(),
            SESSION_RESTORE_TIMEOUT_MS,
            'getCurrentSession (background refresh)',
          );
          if (isMounted && freshSession) {
            console.log('[AuthGuard] Background refresh completed successfully');
            setSession(freshSession);
          } else if (isMounted && !freshSession) {
            console.warn('[AuthGuard] Background refresh returned null — keeping cached session');
          }
        } catch (err) {
          console.warn('[AuthGuard] Background refresh failed — keeping cached session:', err);
        }
        return;
      }

      // No cache hit — fall back to full getCurrentSession
      try {
        const existingSession = await withTimeout(
          repos.authRepo.getCurrentSession(),
          SESSION_RESTORE_TIMEOUT_MS,
          'getCurrentSession',
        );
        if (isMounted && existingSession) {
          console.log('[AuthGuard] Session restored from Supabase (full path)');
          setSession(existingSession);
        } else if (isMounted) {
          console.log('[AuthGuard] No existing session found (or timed out)');
        }
      } catch (err) {
        console.warn('[AuthGuard] Could not restore session:', err);
      }

      if (isMounted) {
        const delay = Platform.OS === 'web' ? 100 : 200;
        setTimeout(() => {
          if (isMounted) setIsReady(true);
        }, delay);
      }
    };

    restoreSession();
    return () => { isMounted = false; };
  }, []);

  // ---- Web fallback: force content if route never resolves ----
  useEffect(() => {
    if (Platform.OS !== 'web' || !isReady || webRouteResolved) return;
    const fallback = setTimeout(() => {
      console.warn('[AuthGuard] Web: forcing route resolved after timeout');
      setWebRouteResolved(true);
    }, 1500);
    return () => clearTimeout(fallback);
  }, [isReady, webRouteResolved]);

  // ---- Navigation guard ----
  useEffect(() => {
    if (!isReady) return;
    if (isNavigatingRef.current) return;
    if (!segments || segments.length === 0) return;

    const currentRoute = segments[0] || '';
    const inAuthGroup = currentRoute === 'login';

    if (!session && !inAuthGroup) {
      navigateSafely('/login');
      return;
    }

    if (session && inAuthGroup) {
      const deepLink = pendingDeepLinkRef.current;
      if (deepLink) {
        pendingDeepLinkRef.current = null;
        navigateSafely(deepLink);
      } else {
        navigateSafely('/(tabs)/production');
      }
      return;
    }

    // On the correct route — allow content to render
    if (!webRouteResolved) {
      setWebRouteResolved(true);
    }
  }, [session, isReady, segments]);

  const navigateSafely = (route: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;

    try {
      console.log(`[AuthGuard] Navigating to ${route}`);
      router.replace(route as any);
    } catch (err) {
      console.warn('[AuthGuard] Navigation error:', err);
    }

    setTimeout(() => { isNavigatingRef.current = false; }, 800);
  };

  if (!isReady || !webRouteResolved) {
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
