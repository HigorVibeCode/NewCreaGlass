import { DeviceTokensRepository } from '../../services/repositories/interfaces';
import { DeviceToken, DevicePlatform } from '../../types';
import { supabase } from '../../services/supabase';

export class SupabaseDeviceTokensRepository implements DeviceTokensRepository {
  async registerDeviceToken(
    token: Omit<DeviceToken, 'id' | 'createdAt' | 'updatedAt' | 'lastSeenAt'>
  ): Promise<DeviceToken> {
    // Try to find existing token
    const { data: existing } = await supabase
      .from('device_tokens')
      .select('*')
      .eq('user_id', token.userId)
      .eq('token', token.token)
      .eq('platform', token.platform)
      .single();

    if (existing) {
      // Update existing token
      const { data, error } = await supabase
        .from('device_tokens')
        .update({
          is_active: true,
          last_seen_at: new Date().toISOString(),
          app_version: token.appVersion,
          device_id: token.deviceId,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating device token:', error);
        throw new Error('Failed to update device token');
      }

      return this.mapToDeviceToken(data);
    }

    // Create new token
    const { data, error } = await supabase
      .from('device_tokens')
      .insert({
        user_id: token.userId,
        platform: token.platform,
        token: token.token,
        device_id: token.deviceId,
        app_version: token.appVersion,
        is_active: true,
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating device token:', error);
      throw new Error('Failed to create device token');
    }

    return this.mapToDeviceToken(data);
  }

  async updateDeviceToken(tokenId: string, updates: Partial<DeviceToken>): Promise<DeviceToken> {
    const updateData: any = {};
    
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
    if (updates.appVersion !== undefined) updateData.app_version = updates.appVersion;
    if (updates.deviceId !== undefined) updateData.device_id = updates.deviceId;
    if (updates.lastSeenAt !== undefined) updateData.last_seen_at = updates.lastSeenAt;

    const { data, error } = await supabase
      .from('device_tokens')
      .update(updateData)
      .eq('id', tokenId)
      .select()
      .single();

    if (error) {
      console.error('Error updating device token:', error);
      throw new Error('Failed to update device token');
    }

    return this.mapToDeviceToken(data);
  }

  async getDeviceTokensByUserId(userId: string): Promise<DeviceToken[]> {
    const { data, error } = await supabase
      .from('device_tokens')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching device tokens:', error);
      throw new Error('Failed to fetch device tokens');
    }

    return (data || []).map(this.mapToDeviceToken);
  }

  async getActiveDeviceTokensByUserId(userId: string): Promise<DeviceToken[]> {
    const { data, error } = await supabase
      .from('device_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching active device tokens:', error);
      throw new Error('Failed to fetch active device tokens');
    }

    return (data || []).map(this.mapToDeviceToken);
  }

  async deactivateDeviceToken(tokenId: string): Promise<void> {
    const { error } = await supabase
      .from('device_tokens')
      .update({ is_active: false })
      .eq('id', tokenId);

    if (error) {
      console.error('Error deactivating device token:', error);
      throw new Error('Failed to deactivate device token');
    }
  }

  async deactivateDeviceTokenByToken(token: string, platform: string): Promise<void> {
    const { error } = await supabase
      .from('device_tokens')
      .update({ is_active: false })
      .eq('token', token)
      .eq('platform', platform);

    if (error) {
      console.error('Error deactivating device token by token:', error);
      throw new Error('Failed to deactivate device token');
    }
  }

  async deleteDeviceToken(tokenId: string): Promise<void> {
    const { error } = await supabase
      .from('device_tokens')
      .delete()
      .eq('id', tokenId);

    if (error) {
      console.error('Error deleting device token:', error);
      throw new Error('Failed to delete device token');
    }
  }

  private mapToDeviceToken(data: any): DeviceToken {
    return {
      id: data.id,
      userId: data.user_id,
      platform: data.platform as DevicePlatform,
      token: data.token,
      deviceId: data.device_id,
      appVersion: data.app_version,
      isActive: data.is_active,
      lastSeenAt: data.last_seen_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
