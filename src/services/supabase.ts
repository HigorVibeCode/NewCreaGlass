import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

// Platform-specific storage
let storage: any;

if (Platform.OS === 'web') {
  // Use localStorage for web
  storage = {
    getItem: (key: string) => {
      if (typeof window !== 'undefined') {
        return Promise.resolve(window.localStorage.getItem(key));
      }
      return Promise.resolve(null);
    },
    setItem: (key: string, value: string) => {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      return Promise.resolve();
    },
  };
} else {
  // Use AsyncStorage for native platforms
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  storage = AsyncStorage;
}

// Supabase configuration from environment variables
// Default values point to the Crea Glass Supabase project
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gnbdumignnzftyzdoztv.supabase.co';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduYmR1bWlnbm56ZnR5emRvenR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTg2NjEsImV4cCI6MjA4NDA3NDY2MX0.Nxqt5rpp17bWnIJXt6xxtDztp0Zh0WWUx3alfHDMMr8';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('Supabase URL or ANON KEY not configured. Please set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your .env file');
}

// Create Supabase client with platform-specific storage for session persistence and Realtime enabled
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
  global: {
    headers: {
      'X-Client-Info': 'crea-glass-app',
    },
  },
});

// Listen for auth state changes and handle refresh token errors
supabase.auth.onAuthStateChange(async (event, session) => {
  // Handle token refresh errors
  if (event === 'TOKEN_REFRESHED' && !session) {
    // Token refresh failed - session is invalid
    console.warn('[Supabase] Token refresh failed, session cleared');
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Ignore errors during signout
      console.warn('[Supabase] Error during signout after token refresh failure:', error);
    }
  }
});
