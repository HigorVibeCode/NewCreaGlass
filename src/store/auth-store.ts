import { create } from 'zustand';
import { Platform } from 'react-native';
import { Session, User } from '../types';
import { repos } from '../services/container';

const USER_PROFILE_CACHE_KEY = '__crea_glass_user_profile__';

function cacheUserProfile(user: User | null): void {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      if (user) {
        window.localStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(user));
      } else {
        window.localStorage.removeItem(USER_PROFILE_CACHE_KEY);
      }
    } else if (Platform.OS !== 'web') {
      const mod = require('@react-native-async-storage/async-storage');
      const AsyncStorage = mod?.default ?? mod;
      if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
        if (user) {
          AsyncStorage.setItem(USER_PROFILE_CACHE_KEY, JSON.stringify(user)).catch(() => {});
        } else {
          AsyncStorage.removeItem(USER_PROFILE_CACHE_KEY).catch(() => {});
        }
      }
    }
  } catch {}
}

export function getCachedUserProfile(): User | null {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const stored = window.localStorage.getItem(USER_PROFILE_CACHE_KEY);
      if (stored) return JSON.parse(stored);
    }
  } catch {}
  return null;
}

export async function getCachedUserProfileAsync(): Promise<User | null> {
  try {
    if (Platform.OS === 'web') {
      return getCachedUserProfile();
    }
    const mod = require('@react-native-async-storage/async-storage');
    const AsyncStorage = mod?.default ?? mod;
    if (!AsyncStorage || typeof AsyncStorage.getItem !== 'function') return null;
    const stored = await AsyncStorage.getItem(USER_PROFILE_CACHE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return null;
}

interface AuthState {
  session: Session | null;
  isLoading: boolean;
  setSession: (session: Session | null) => void;
  clearSession: () => void;
  setLoading: (loading: boolean) => void;
}

/**
 * Auth store — session is kept in memory only.
 * Supabase already persists its own auth session in local storage.
 * On app restart, AuthGuard restores the session from Supabase.
 * User profile is also cached in local storage for instant restoration.
 */
export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  isLoading: false,
  setSession: (session) => {
    cacheUserProfile(session?.user ?? null);
    set({ session });
  },
  clearSession: () => {
    cacheUserProfile(null);
    set({ session: null });
  },
  setLoading: (isLoading) => set({ isLoading }),
}));

export const useAuth = () => {
  const store = useAuthStore();
  
  const logout = async () => {
    try {
      await repos.authRepo.logout();
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      store.clearSession();
    }
  };
  
  return {
    user: store.session?.user ?? null,
    session: store.session,
    isLoading: store.isLoading,
    isAuthenticated: !!store.session,
    setSession: store.setSession,
    logout,
    setLoading: store.setLoading,
  };
};
