import { Router } from 'expo-router';
import { Platform } from 'react-native';

/**
 * In-memory store for navigation params, keyed by target route.
 *
 * expo-router v6 on web does NOT reliably pass search/query params via
 * router.push(). This store bridges the gap: the source screen writes
 * params here before pushing, and the target screen reads them on mount
 * via useRouteParams().
 */
const _pendingParams: Record<string, Record<string, string>> = {};

export function setPendingParams(route: string, params: Record<string, string>) {
  _pendingParams[route] = { ...params };
}

export function consumePendingParams(route: string): Record<string, string> {
  const p = _pendingParams[route] || {};
  delete _pendingParams[route];
  return p;
}

/**
 * Navigate to a route with params that work on both native and web.
 *
 * Strategy:
 *  - Always encode params as query string in the URL (works for native,
 *    and gives useLocalSearchParams a chance on web).
 *  - On web, ALSO store params in-memory + sessionStorage as fallbacks.
 */
export function pushWithParams(
  router: Router,
  pathname: string,
  params: Record<string, string>,
) {
  const qs = new URLSearchParams(params).toString();
  const href = qs ? `${pathname}?${qs}` : pathname;

  if (Platform.OS === 'web') {
    setPendingParams(pathname, params);
    try {
      sessionStorage.setItem(`__nav_params__${pathname}`, JSON.stringify(params));
    } catch {}
  }

  router.push(href as any);
}
