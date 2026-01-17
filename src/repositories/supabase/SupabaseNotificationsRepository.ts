import { NotificationsRepository } from '../../services/repositories/interfaces';
import { Notification } from '../../types';
import { supabase } from '../../services/supabase';
import { triggerNotificationAlert } from '../../utils/notification-alert';

export class SupabaseNotificationsRepository implements NotificationsRepository {
  async getUserNotifications(userId: string): Promise<Notification[]> {
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .or(`target_user_id.is.null,target_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notifications:', error);
      throw new Error('Failed to fetch notifications');
    }

    // Get read records for this user
    const { data: reads } = await supabase
      .from('notification_reads')
      .select('notification_id, read_at')
      .eq('user_id', userId);

    const readMap = new Map<string, string>();
    if (reads) {
      reads.forEach(read => {
        if (read.read_at) {
          readMap.set(read.notification_id, read.read_at);
        }
      });
    }

    // Map notifications and add readAt from notification_reads table
    return (data || []).map(notif => {
      const mapped = this.mapToNotification(notif);
      const readAt = readMap.get(notif.id);
      return { ...mapped, readAt };
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    // Get all notifications for user
    const { data: notifications } = await supabase
      .from('notifications')
      .select('id')
      .or(`target_user_id.is.null,target_user_id.eq.${userId}`);

    if (!notifications || notifications.length === 0) {
      return 0;
    }

    // Get read notification IDs for this user
    const { data: reads } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', userId)
      .not('read_at', 'is', null);

    const readIds = new Set((reads || []).map(r => r.notification_id));
    
    // Count unread notifications
    return notifications.filter(n => !readIds.has(n.id)).length;
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    console.log('Marking notification as read:', { notificationId, userId });
    
    // Verify this notification is accessible by this user
    const { data: notification, error: fetchError } = await supabase
      .from('notifications')
      .select('target_user_id')
      .eq('id', notificationId)
      .single();

    if (fetchError) {
      console.error('Error fetching notification:', fetchError);
      throw new Error('Notification not found');
    }

    // Allow marking as read if:
    // 1. Notification has no target_user_id (global notification)
    // 2. Notification's target_user_id matches the user
    if (notification && notification.target_user_id && notification.target_user_id !== userId) {
      throw new Error('Notification does not belong to user');
    }

    const readAt = new Date().toISOString();
    console.log('Creating/updating notification_reads record:', readAt);
    
    // Check if read record already exists
    const { data: existingReads } = await supabase
      .from('notification_reads')
      .select('id')
      .eq('notification_id', notificationId)
      .eq('user_id', userId)
      .limit(1);

    if (existingReads && existingReads.length > 0) {
      // Update existing read record
      const { error } = await supabase
        .from('notification_reads')
        .update({ read_at: readAt })
        .eq('notification_id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating notification read:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to mark notification as read: ${error.message || 'Unknown error'}`);
      }
    } else {
      // Create new read record
      const { error } = await supabase
        .from('notification_reads')
        .insert({
          notification_id: notificationId,
          user_id: userId,
          read_at: readAt,
        });

      if (error) {
        console.error('Error creating notification read:', error);
        console.error('Error details:', JSON.stringify(error, null, 2));
        throw new Error(`Failed to mark notification as read: ${error.message || 'Unknown error'}`);
      }
    }

    console.log('Notification marked as read successfully');
  }

  async createNotification(
    notification: Omit<Notification, 'id' | 'createdAt'>
  ): Promise<Notification> {
    // RLS policy requires: created_by_system = true
    // Make sure we're creating system notifications
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        type: notification.type,
        payload_json: notification.payloadJson,
        created_by_system: notification.createdBySystem !== undefined ? notification.createdBySystem : true,
        target_user_id: notification.targetUserId || null,
        read_at: notification.readAt || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating notification:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      console.error('Notification data:', JSON.stringify(notification, null, 2));
      throw new Error(`Failed to create notification: ${error.message || 'Unknown error'}`);
    }

    // Trigger vibration and sound alert with message (não aguardamos o som terminar)
    let alertMessage: string | undefined;
    if (notification.type === 'inventory.lowStock' && notification.payloadJson) {
      alertMessage = `Estoque baixo: ${notification.payloadJson.itemName || 'Item'} (${notification.payloadJson.stock || 0} unidades)`;
    } else if (notification.type === 'production.authorized' && notification.payloadJson) {
      const clientName = notification.payloadJson.clientName || '';
      const orderType = notification.payloadJson.orderType || '';
      const orderNumber = notification.payloadJson.orderNumber || '';
      alertMessage = `${clientName} | ${orderType} | ${orderNumber} - Autorizado`;
    }
    triggerNotificationAlert(notification.type, alertMessage).catch(err => {
      console.warn('Failed to trigger notification alert:', err);
    });

    return this.mapToNotification(data);
  }

  async clearUserNotifications(userId: string): Promise<void> {
    console.log('Clearing all notifications for user:', userId);
    
    // Get all unread notifications for this user
    const { data: notifications } = await supabase
      .from('notifications')
      .select('id')
      .or(`target_user_id.is.null,target_user_id.eq.${userId}`);

    if (!notifications || notifications.length === 0) {
      console.log('No notifications to clear');
      return;
    }

    // Get already read notification IDs
    const { data: existingReads } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', userId);

    const readIds = new Set((existingReads || []).map(r => r.notification_id));
    const unreadNotificationIds = notifications
      .map(n => n.id)
      .filter(id => !readIds.has(id));

    if (unreadNotificationIds.length === 0) {
      console.log('All notifications already read');
      return;
    }

    const readAt = new Date().toISOString();
    
    // Create read records for all unread notifications
    const readsToInsert = unreadNotificationIds.map(notificationId => ({
      notification_id: notificationId,
      user_id: userId,
      read_at: readAt,
    }));

    const { error } = await supabase
      .from('notification_reads')
      .insert(readsToInsert);

    if (error) {
      console.error('Error clearing notifications:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to clear notifications: ${error.message || 'Unknown error'}`);
    }

    console.log(`Cleared ${unreadNotificationIds.length} notifications`);
  }

  private mapToNotification(data: any): Notification {
    return {
      id: data.id,
      type: data.type,
      payloadJson: data.payload_json || {},
      createdAt: data.created_at,
      createdBySystem: data.created_by_system ?? false,
      targetUserId: data.target_user_id || undefined,
      // readAt is now set from notification_reads table in getUserNotifications
      readAt: undefined,
    };
  }
}
