import { Router, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Platform } from 'react-native';

/**
 * Back navigation that works on both native and web.
 *
 * Strategy:
 * 1. Try router.back() first (works when the navigation stack has a previous entry).
 * 2. On web, if canGoBack() is false, try window.history.back() as a secondary check
 *    (browser history may have entries that the expo-router stack doesn't track).
 * 3. Final fallback: router.replace(fallback) to a known safe route.
 */
export function safeBack(router: Router, fallback: string = '/(tabs)/production') {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.history.length > 1) {
    window.history.back();
    return;
  }

  router.replace(fallback as any);
}

export function useGoBack(fallback: string = '/(tabs)/production') {
  const router = useRouter();
  return useCallback(() => safeBack(router, fallback), [router, fallback]);
}
