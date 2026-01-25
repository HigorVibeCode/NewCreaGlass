import { AuthRepository } from '../../services/repositories/interfaces';
import { Session, User } from '../../types';
import { supabase } from '../../services/supabase';

export class SupabaseAuthRepository implements AuthRepository {
  private supabase;

  constructor() {
    this.supabase = supabase;
  }

  async login(username: string, password: string): Promise<Session> {
    try {
      // Find user by username to get their ID
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('id, username, user_type, is_active, created_at')
        .eq('username', username)
        .single();

      if (userError || !userData) {
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!userData.is_active) {
        throw new Error('User account is inactive');
      }

      // Try to login with username@creaglass.local pattern (email is case-insensitive)
      // This is the standard pattern we'll use for username-based auth
      const emailToUse = `${username.toLowerCase()}@creaglass.local`;
      
      const { data: authData, error: authError } = await this.supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password,
      });

      if (authError || !authData.user) {
        // Fallback: try username directly as email
        const { data: authData2, error: authError2 } = await this.supabase.auth.signInWithPassword({
          email: username,
          password: password,
        });

        if (authError2 || !authData2.user) {
          throw new Error('Invalid credentials');
        }

        // Verify user ID matches
        if (authData2.user.id !== userData.id) {
          throw new Error('Invalid credentials');
        }

        const user: User = {
          id: userData.id,
          username: userData.username,
          userType: userData.user_type as any,
          isActive: userData.is_active,
          createdAt: userData.created_at,
        };

        return {
          user,
          token: authData2.session?.access_token || '',
        };
      }

      // Verify the auth user matches our user record
      if (authData.user.id !== userData.id) {
        throw new Error('Invalid credentials');
      }

      const user: User = {
        id: userData.id,
        username: userData.username,
        userType: userData.user_type as any,
        isActive: userData.is_active,
        createdAt: userData.created_at,
      };

      return {
        user,
        token: authData.session?.access_token || '',
      };
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Invalid credentials');
    }
  }

  async logout(): Promise<void> {
    try {
      await this.supabase.auth.signOut();
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  }

  async getCurrentSession(): Promise<Session | null> {
    try {
      const { data: { session: supabaseSession }, error } = await this.supabase.auth.getSession();
      
      // Handle refresh token errors
      if (error) {
        // Check if error is related to invalid refresh token
        if (error.message?.includes('Refresh Token') || 
            error.message?.includes('invalid_grant') ||
            error.message?.includes('Invalid Refresh Token')) {
          console.warn('[SupabaseAuthRepository] Invalid refresh token detected, clearing session');
          // Clear invalid session
          try {
            await this.supabase.auth.signOut();
          } catch (signOutError) {
            // Ignore errors during signout
            console.warn('[SupabaseAuthRepository] Error during signout:', signOutError);
          }
          return null;
        }
        return null;
      }
      
      if (!supabaseSession) {
        return null;
      }

      // Get user profile
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', supabaseSession.user.id)
        .single();

      if (userError || !userData) {
        return null;
      }

      const user: User = {
        id: userData.id,
        username: userData.username,
        userType: userData.user_type as any,
        isActive: userData.is_active,
        createdAt: userData.created_at,
      };

      return {
        user,
        token: supabaseSession.access_token,
      };
    } catch (error) {
      console.error('Error getting current session:', error);
      return null;
    }
  }

  async validateSession(session: Session): Promise<boolean> {
    try {
      // If no session token, invalid
      if (!session || !session.token) {
        return false;
      }

      // Get current Supabase session
      const { data: { session: supabaseSession }, error: sessionError } = await this.supabase.auth.getSession();
      
      // Handle refresh token errors
      if (sessionError) {
        // Check if error is related to invalid refresh token
        if (sessionError.message?.includes('Refresh Token') || 
            sessionError.message?.includes('invalid_grant') ||
            sessionError.message?.includes('Invalid Refresh Token')) {
          console.warn('[SupabaseAuthRepository] Invalid refresh token during validation, clearing session');
          // Clear invalid session
          try {
            await this.supabase.auth.signOut();
          } catch (signOutError) {
            // Ignore errors during signout
            console.warn('[SupabaseAuthRepository] Error during signout:', signOutError);
          }
        }
        console.log('No Supabase session found:', sessionError?.message);
        return false;
      }
      
      if (!supabaseSession) {
        return false;
      }

      // Validate user ID matches (more reliable than token comparison)
      if (supabaseSession.user.id !== session.user.id) {
        console.log('User ID mismatch:', supabaseSession.user.id, 'vs', session.user.id);
        return false;
      }

      // Validate user is still active
      const { data: userData, error: userError } = await this.supabase
        .from('users')
        .select('is_active')
        .eq('id', session.user.id)
        .single();

      if (userError || !userData) {
        console.log('User not found or error:', userError?.message);
        return false;
      }

      // Check if user is still active
      if (!userData.is_active) {
        console.log('User is inactive');
        return false;
      }

      // Session is valid if Supabase session exists and user is active
      // Token comparison can be skipped as Supabase manages session lifecycle
      return true;
    } catch (error) {
      console.error('Error validating session:', error);
      return false;
    }
  }
}
