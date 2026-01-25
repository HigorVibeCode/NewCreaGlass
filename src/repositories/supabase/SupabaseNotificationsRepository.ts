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

    console.log(`[getUserNotifications] Found ${data?.length || 0} notifications for user ${userId}`);

    // Get ALL read records for this user (including hidden ones to filter them out)
    const { data: allReads } = await supabase
      .from('notification_reads')
      .select('notification_id, read_at, hidden_at')
      .eq('user_id', userId);

    const readMap = new Map<string, string>();
    const hiddenIds = new Set<string>();
    
    if (allReads) {
      console.log(`[getUserNotifications] Found ${allReads.length} read records for user ${userId}`);
      allReads.forEach(read => {
        if (read.hidden_at) {
          // Notification is hidden - don't show it
          hiddenIds.add(read.notification_id);
        } else if (read.read_at) {
          // Notification is read but not hidden
          readMap.set(read.notification_id, read.read_at);
        }
      });
    }

    console.log(`[getUserNotifications] Hidden notifications: ${hiddenIds.size}`);

    // Map notifications, exclude hidden ones, and add readAt from notification_reads table
    const filtered = (data || [])
      .filter(notif => !hiddenIds.has(notif.id)) // Filter out hidden notifications
      .map(notif => {
        const mapped = this.mapToNotification(notif);
        const readAt = readMap.get(notif.id);
        return { ...mapped, readAt };
      });

    console.log(`[getUserNotifications] Returning ${filtered.length} notifications after filtering`);
    return filtered;
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

    // Get read notification IDs for this user (excluding hidden)
    const { data: reads } = await supabase
      .from('notification_reads')
      .select('notification_id, hidden_at')
      .eq('user_id', userId)
      .is('hidden_at', null) // Only count non-hidden notifications
      .not('read_at', 'is', null);

    const readIds = new Set((reads || []).map(r => r.notification_id));
    
    // Get hidden notification IDs
    const { data: hiddenReads } = await supabase
      .from('notification_reads')
      .select('notification_id')
      .eq('user_id', userId)
      .not('hidden_at', 'is', null);

    const hiddenIds = new Set((hiddenReads || []).map(r => r.notification_id));
    
    // Count unread notifications (excluding hidden ones)
    return notifications.filter(n => !readIds.has(n.id) && !hiddenIds.has(n.id)).length;
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
    
    // Use upsert to handle both insert and update in one operation
    // This ensures the record is always updated correctly
    const { error } = await supabase
      .from('notification_reads')
      .upsert(
        {
          notification_id: notificationId,
          user_id: userId,
          read_at: readAt,
          hidden_at: null, // Ensure it's not hidden when marking as read
        },
        {
          onConflict: 'notification_id,user_id',
          ignoreDuplicates: false,
        }
      );

    if (error) {
      console.error('Error upserting notification read:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to mark notification as read: ${error.message || 'Unknown error'}`);
    }

    console.log('Notification marked as read successfully');
  }

  async createNotification(
    notification: Omit<Notification, 'id' | 'createdAt'>
  ): Promise<Notification> {
    // RLS policy requires: created_by_system = true
    // Make sure we're creating system notifications
    
    // Log payload for debugging
    if (__DEV__) {
      console.log('[createNotification] Creating notification:', {
        type: notification.type,
        payloadJson: notification.payloadJson,
      });
    }
    
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

    const createdNotification = this.mapToNotification(data);
    
    // Log created notification for debugging
    if (__DEV__) {
      console.log('[createNotification] Notification created:', {
        id: createdNotification.id,
        type: createdNotification.type,
        payloadJson: createdNotification.payloadJson,
      });
    }

    // Trigger vibration and sound alert with message (não aguardamos o som terminar)
    let alertMessage: string | undefined;
    if (notification.type === 'inventory.lowStock' && notification.payloadJson) {
      alertMessage = `Estoque baixo: ${notification.payloadJson.itemName || 'Item'} (${notification.payloadJson.stock || 0} unidades)`;
    } else if (notification.type === 'production.authorized' && notification.payloadJson) {
      const clientName = notification.payloadJson.clientName || 'Cliente';
      const orderType = notification.payloadJson.orderType || '';
      const orderNumber = notification.payloadJson.orderNumber || '';
      alertMessage = `${clientName} | ${orderType} | ${orderNumber} - Autorizado`;
    } else if (notification.type === 'production.tempered' && notification.payloadJson) {
      const clientName = notification.payloadJson.clientName || 'Cliente';
      const orderType = notification.payloadJson.orderType || '';
      const orderNumber = notification.payloadJson.orderNumber || '';
      alertMessage = `${clientName} | ${orderType} | ${orderNumber} - Entrou na fase de temperamento`;
    }
    triggerNotificationAlert(notification.type, alertMessage).catch(err => {
      console.warn('Failed to trigger notification alert:', err);
    });

    // Dispatch push notifications asynchronously (não bloqueia a criação)
    this.dispatchPushNotifications(createdNotification).catch(err => {
      console.error('[SupabaseNotificationsRepository] Error dispatching push notifications:', err);
      // Não propagar erro - push é secundário à criação da notificação
    });

    return createdNotification;
  }

  async clearUserNotifications(userId: string): Promise<void> {
    console.log('Clearing all notifications for user:', userId);
    
    // First, check if hidden_at column exists (migration may not have been run)
    // If it doesn't exist, we'll delete all notification_reads records instead
    try {
      // Get ALL notifications for this user (both read and unread)
      const { data: notifications, error: fetchError } = await supabase
        .from('notifications')
        .select('id')
        .or(`target_user_id.is.null,target_user_id.eq.${userId}`);

      if (fetchError) {
        console.error('Error fetching notifications:', fetchError);
        throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
      }

      if (!notifications || notifications.length === 0) {
        console.log('No notifications to clear');
        return;
      }

      const hiddenAt = new Date().toISOString();
      const readAt = new Date().toISOString();
      const notificationIds = notifications.map(n => n.id);
      
      // Try to use hidden_at first (if migration was run)
      // Process in batches to avoid potential issues with large arrays
      const batchSize = 100;
      for (let i = 0; i < notificationIds.length; i += batchSize) {
        const batch = notificationIds.slice(i, i + batchSize);
        const readsToUpsert = batch.map(notificationId => ({
          notification_id: notificationId,
          user_id: userId,
          read_at: readAt,
          hidden_at: hiddenAt,
        }));

        const { error: upsertError } = await supabase
          .from('notification_reads')
          .upsert(readsToUpsert, {
            onConflict: 'notification_id,user_id',
            ignoreDuplicates: false,
          });

        if (upsertError) {
          // If error mentions hidden_at doesn't exist, fallback to marking all as read
          // This way notifications stay marked as read and don't reappear
          if (upsertError.message?.includes('hidden_at') || upsertError.message?.includes('column') || upsertError.code === '42703') {
            console.warn('hidden_at column may not exist, falling back to mark-all-as-read method');
            
            // Fallback: Mark all notifications as read (without hidden_at)
            // This prevents them from showing as unread, but they'll still appear as read
            const readAt = new Date().toISOString();
            const readsToUpsert = notificationIds.map(notificationId => ({
              notification_id: notificationId,
              user_id: userId,
              read_at: readAt,
              // Don't include hidden_at - column doesn't exist
            }));

            const { error: fallbackError } = await supabase
              .from('notification_reads')
              .upsert(readsToUpsert, {
                onConflict: 'notification_id,user_id',
                ignoreDuplicates: false,
              });

            if (fallbackError) {
              console.error('Error in fallback method:', fallbackError);
              throw new Error(`Failed to clear notifications: ${fallbackError.message || 'Unknown error'}. Please run the migration to add hidden_at column.`);
            }
            
            console.log(`Marked all ${notificationIds.length} notifications as read (hidden_at column not available)`);
            console.warn('IMPORTANT: Run migration add_hidden_at_to_notification_reads.sql to enable full clear functionality');
            return;
          }
          
          console.error('Error hiding notifications:', upsertError);
          console.error('Error details:', JSON.stringify(upsertError, null, 2));
          throw new Error(`Failed to clear notifications: ${upsertError.message || 'Unknown error'}`);
        }
      }

      console.log(`Cleared (hidden) all ${notifications.length} notifications for user`);
    } catch (error: any) {
      console.error('Error in clearUserNotifications:', error);
      throw error;
    }
  }

  /**
   * Dispatch push notifications for a created notification
   * Runs asynchronously and doesn't block notification creation
   * Uses lazy imports to avoid require cycles
   */
  private async dispatchPushNotifications(notification: Notification): Promise<void> {
    try {
      // Lazy import to avoid require cycle
      const { pushNotificationService } = await import('../../services/push-notifications');
      const { repos } = await import('../../services/container');

      // Determine target users
      let targetUserIds: string[] = [];

      if (notification.targetUserId) {
        // Specific user target
        targetUserIds = [notification.targetUserId];
      } else {
        // Global notification - get all active users with push enabled
        // For now, we'll need to fetch users separately
        // In a production system, this could be optimized with a database function
        const { data: users } = await supabase
          .from('users')
          .select('id')
          .eq('is_active', true);

        if (users) {
          targetUserIds = users.map(u => u.id);
        }
      }

      if (targetUserIds.length === 0) {
        // No target users - this is expected for notifications with specific target_user_id that doesn't exist
        if (__DEV__) {
          console.log('[dispatchPushNotifications] No target users found');
        }
        return;
      }

      // Generate push notification content
      const { title, body } = pushNotificationService.generateNotificationContent(notification);
      const deepLink = pushNotificationService.generateDeepLink(notification);

      const payload = {
        title,
        body,
        data: {
          notificationId: notification.id,
          type: notification.type,
          entityId: notification.payloadJson?.itemId || 
                   notification.payloadJson?.productionId || 
                   notification.payloadJson?.workOrderId || 
                   notification.payloadJson?.trainingId || 
                   notification.payloadJson?.messageId || 
                   notification.payloadJson?.eventId,
          deepLink,
          ...notification.payloadJson,
        },
      };

      // Process each target user
      for (const userId of targetUserIds) {
        try {
          // Check if user should receive push
          const shouldSend = await pushNotificationService.shouldSendPush(userId, notification.type);
          if (!shouldSend) {
            // User has push notifications disabled for this type - this is expected behavior
            if (__DEV__) {
              console.log(`[dispatchPushNotifications] User ${userId} has push disabled for type ${notification.type}`);
            }
            continue;
          }

          // Get active device tokens for user
          const deviceTokens = await repos.deviceTokensRepo.getActiveDeviceTokensByUserId(userId);
          
          if (deviceTokens.length === 0) {
            // This is expected if user hasn't logged in on any device yet or hasn't granted notification permissions
            // Only log in debug mode to reduce console noise
            if (__DEV__) {
              console.log(`[dispatchPushNotifications] No active device tokens for user ${userId} - user may not have logged in on any device or granted notification permissions`);
            }
            continue;
          }

          // Send push to all user's devices
          const tokens = deviceTokens.map(dt => ({
            token: dt.token,
            platform: dt.platform,
            deviceTokenId: dt.id,
          }));

          const results = await pushNotificationService.sendToTokens(tokens, payload);

          // Log delivery attempts
          for (let i = 0; i < results.length; i++) {
            const result = results[i];
            const deviceToken = deviceTokens[i];

            await repos.pushDeliveryLogsRepo.createLog({
              notificationId: notification.id,
              userId,
              deviceTokenId: deviceToken.id,
              token: deviceToken.token,
              status: result.success ? 'sent' : 'failed',
              errorMessage: result.error,
              sentAt: result.success ? new Date().toISOString() : undefined,
            });
          }
        } catch (userError: any) {
          console.error(`[dispatchPushNotifications] Error processing user ${userId}:`, userError);
          // Continue with next user
        }
      }
    } catch (error: any) {
      console.error('[dispatchPushNotifications] Error:', error);
      // Don't throw - push is secondary to notification creation
    }
  }

  private mapToNotification(data: any): Notification {
    // Parse payload_json if it's a string, otherwise use as-is
    let payloadJson: Record<string, any> = {};
    if (data.payload_json) {
      if (typeof data.payload_json === 'string') {
        try {
          payloadJson = JSON.parse(data.payload_json);
        } catch (error) {
          console.warn('[mapToNotification] Error parsing payload_json:', error);
          payloadJson = {};
        }
      } else if (typeof data.payload_json === 'object') {
        payloadJson = data.payload_json;
      }
    }

    // Debug log in development for specific notification types
    if (__DEV__ && (data.type === 'production.tempered' || data.type === 'workOrder.created' || data.type === 'event.created')) {
      console.log('[mapToNotification] Parsed notification:', {
        type: data.type,
        payloadJson,
        payload_json_type: typeof data.payload_json,
        scheduledDate: payloadJson?.scheduledDate,
        scheduledTime: payloadJson?.scheduledTime,
        startDate: payloadJson?.startDate,
        startTime: payloadJson?.startTime,
      });
    }

    return {
      id: data.id,
      type: data.type,
      payloadJson,
      createdAt: data.created_at,
      createdBySystem: data.created_by_system ?? false,
      targetUserId: data.target_user_id || undefined,
      // readAt is now set from notification_reads table in getUserNotifications
      readAt: undefined,
    };
  }
}
