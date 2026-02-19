import { UsersRepository } from '../../services/repositories/interfaces';
import { User, UserType } from '../../types';
import { supabase } from '../../services/supabase';

export class SupabaseUsersRepository implements UsersRepository {
  async getAllUsers(): Promise<User[]> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      throw new Error('Failed to fetch users');
    }

    return (data || []).map(this.mapToUser);
  }

  async getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user:', error);
      throw new Error('Failed to fetch user');
    }

    return data ? this.mapToUser(data) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', username)
      .maybeSingle();

    if (error) {
      console.error('Error fetching user by username:', error);
      throw new Error('Failed to fetch user');
    }

    return data ? this.mapToUser(data) : null;
  }

  async createUser(user: Omit<User, 'id' | 'createdAt'>, password?: string): Promise<User> {
    // Note: User creation in Supabase Auth must be done via admin API or Edge Function
    // For now, this will create the user profile, but auth user must be created separately
    // In production, use an Edge Function to create both auth user and profile atomically
    
    // Use Edge Function to create user (which handles both auth user and profile)
    try {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://gnbdumignnzftyzdoztv.supabase.co';
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImduYmR1bWlnbm56ZnR5emRvenR2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg0OTg2NjEsImV4cCI6MjA4NDA3NDY2MX0.Nxqt5rpp17bWnIJXt6xxtDztp0Zh0WWUx3alfHDMMr8';
      
      const response = await fetch(`${supabaseUrl}/functions/v1/create-master-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify({
          username: user.username,
          email: `${user.username.toLowerCase()}@creaglass.local`,
          password: password || 'defaultPassword123',
          userType: user.userType,
        }),
      });

      if (!response.ok) {
        let errorMessage = 'Failed to create user';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (parseError) {
          // If response is not JSON, try to get text
          try {
            const text = await response.text();
            if (text) errorMessage = text;
          } catch (textError) {
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || result.message || 'Failed to create user');
      }
      
      // Fetch the created user
      if (result.userId) {
        return await this.getUserById(result.userId);
      } else {
        throw new Error('User created but userId not returned');
      }
    } catch (error: any) {
      console.error('Error creating user via Edge Function:', error);
      
      // Provide more specific error messages
      if (error.message) {
        throw error; // Re-throw with the original message
      } else if (error.name === 'TypeError' && error.message?.includes('fetch')) {
        throw new Error('Network request failed. Please check your internet connection.');
      } else {
        throw new Error(error.message || 'User creation failed. Please ensure the Edge Function is deployed and accessible.');
      }
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const updateData: any = {};
    
    if (updates.username !== undefined) updateData.username = updates.username;
    if (updates.userType !== undefined) updateData.user_type = updates.userType;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('users')
      .update(updateData)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user:', error);
      throw new Error('Failed to update user');
    }

    return this.mapToUser(data);
  }

  async activateUser(userId: string): Promise<void> {
    await this.updateUser(userId, { isActive: true });
  }

  async deactivateUser(userId: string): Promise<void> {
    await this.updateUser(userId, { isActive: false });
  }

  async changeUserPassword(userId: string, newPassword: string): Promise<void> {
    // Password change must be done through Supabase Auth API or Edge Function
    // For now, this is a placeholder - use Supabase Auth password reset or Edge Function
    throw new Error('Password change must be done through Edge Function or Supabase Auth API');
  }

  async updatePreferredLanguage(userId: string, language: string): Promise<void> {
    const { error } = await supabase
      .from('users')
      .update({ preferred_language: language })
      .eq('id', userId);

    if (error) {
      console.error('Error updating preferred language:', error);
      // Non-critical - don't throw, just log
    }
  }

  private mapToUser(data: any): User {
    return {
      id: data.id,
      username: data.username,
      userType: data.user_type as UserType,
      isActive: data.is_active,
      preferredLanguage: data.preferred_language || 'en',
      createdAt: data.created_at,
    };
  }
}
