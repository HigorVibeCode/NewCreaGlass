import { useLocalSearchParams } from 'expo-router';
import { useRef } from 'react';
import { Platform } from 'react-native';
import { consumePendingParams } from '../utils/navigation';

/**
 * Read route params reliably on both native and web.
 *
 * @param routeKey The route path this screen was pushed with (e.g. '/production-detail').
 *                 Must match the pathname used in pushWithParams().
 *
 * On native: delegates to useLocalSearchParams (works normally).
 * On web: tries three sources in order:
 *   1. In-memory pending params store (fastest, same SPA session).
 *   2. sessionStorage (survives in-app page refreshes).
 *   3. useLocalSearchParams / URL query params (standard fallback).
 */
export function useRouteParams<T extends Record<string, string>>(routeKey: string): T {
  const localParams = useLocalSearchParams<T>();

  const webParamsRef = useRef<Record<string, string> | null>(null);

  if (Platform.OS === 'web' && webParamsRef.current === null) {
    let params = consumePendingParams(routeKey);

    if (Object.keys(params).length === 0) {
      try {
        const stored = sessionStorage.getItem(`__nav_params__${routeKey}`);
        if (stored) {
          params = JSON.parse(stored);
          sessionStorage.removeItem(`__nav_params__${routeKey}`);
        }
      } catch {}
    }

    if (Object.keys(params).length > 0) {
      webParamsRef.current = params;
    }
  }

  if (Platform.OS === 'web' && webParamsRef.current) {
    const filtered: Record<string, any> = {};
    for (const [k, v] of Object.entries(localParams)) {
      if (v !== undefined && v !== null && v !== '') {
        filtered[k] = v;
      }
    }
    return { ...webParamsRef.current, ...filtered } as T;
  }

  return localParams as T;
}
