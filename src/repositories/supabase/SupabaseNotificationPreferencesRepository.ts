import { NotificationPreferencesRepository } from '../../services/repositories/interfaces';
import { NotificationPreferences } from '../../types';
import { supabase } from '../../services/supabase';

export class SupabaseNotificationPreferencesRepository implements NotificationPreferencesRepository {
  async getPreferencesByUserId(userId: string): Promise<NotificationPreferences | null> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // No preferences found
        return null;
      }
      console.error('Error fetching notification preferences:', error);
      throw new Error('Failed to fetch notification preferences');
    }

    if (!data) return null;

    return this.mapToNotificationPreferences(data);
  }

  async createPreferences(
    preferences: Omit<NotificationPreferences, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<NotificationPreferences> {
    const { data, error } = await supabase
      .from('notification_preferences')
      .insert({
        user_id: preferences.userId,
        push_enabled: preferences.pushEnabled,
        work_orders_enabled: preferences.workOrdersEnabled,
        inventory_enabled: preferences.inventoryEnabled,
        training_enabled: preferences.trainingEnabled,
        blood_priority_enabled: preferences.bloodPriorityEnabled,
        production_enabled: preferences.productionEnabled,
        events_enabled: preferences.eventsEnabled,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification preferences:', error);
      throw new Error('Failed to create notification preferences');
    }

    return this.mapToNotificationPreferences(data);
  }

  async updatePreferences(
    userId: string,
    updates: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    const updateData: any = {};
    
    if (updates.pushEnabled !== undefined) updateData.push_enabled = updates.pushEnabled;
    if (updates.workOrdersEnabled !== undefined) updateData.work_orders_enabled = updates.workOrdersEnabled;
    if (updates.inventoryEnabled !== undefined) updateData.inventory_enabled = updates.inventoryEnabled;
    if (updates.trainingEnabled !== undefined) updateData.training_enabled = updates.trainingEnabled;
    if (updates.bloodPriorityEnabled !== undefined) updateData.blood_priority_enabled = updates.bloodPriorityEnabled;
    if (updates.productionEnabled !== undefined) updateData.production_enabled = updates.productionEnabled;
    if (updates.eventsEnabled !== undefined) updateData.events_enabled = updates.eventsEnabled;

    const { data, error } = await supabase
      .from('notification_preferences')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('Error updating notification preferences:', error);
      throw new Error('Failed to update notification preferences');
    }

    return this.mapToNotificationPreferences(data);
  }

  async getOrCreatePreferences(userId: string): Promise<NotificationPreferences> {
    let preferences = await this.getPreferencesByUserId(userId);
    
    if (!preferences) {
      // Create default preferences
      preferences = await this.createPreferences({
        userId,
        pushEnabled: true,
        workOrdersEnabled: true,
        inventoryEnabled: true,
        trainingEnabled: true,
        bloodPriorityEnabled: true,
        productionEnabled: true,
        eventsEnabled: true,
      });
    }

    return preferences;
  }

  private mapToNotificationPreferences(data: any): NotificationPreferences {
    return {
      id: data.id,
      userId: data.user_id,
      pushEnabled: data.push_enabled,
      workOrdersEnabled: data.work_orders_enabled,
      inventoryEnabled: data.inventory_enabled,
      trainingEnabled: data.training_enabled,
      bloodPriorityEnabled: data.blood_priority_enabled,
      productionEnabled: data.production_enabled,
      eventsEnabled: data.events_enabled,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
