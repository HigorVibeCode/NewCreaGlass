import { create } from 'zustand';
import { Session } from '../types';
import { repos } from '../services/container';

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
 */
export const useAuthStore = create<AuthState>()((set) => ({
  session: null,
  isLoading: false,
  setSession: (session) => set({ session }),
  clearSession: () => set({ session: null }),
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
