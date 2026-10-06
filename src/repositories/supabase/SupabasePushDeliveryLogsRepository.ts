import { PushDeliveryLogsRepository } from '../../services/repositories/interfaces';
import { PushDeliveryLog, PushDeliveryStatus } from '../../types';
import { supabase } from '../../services/supabase';

export class SupabasePushDeliveryLogsRepository implements PushDeliveryLogsRepository {
  async createLog(log: Omit<PushDeliveryLog, 'id' | 'createdAt'>): Promise<PushDeliveryLog> {
    const { data, error } = await supabase
      .from('push_delivery_logs')
      .insert({
        notification_id: log.notificationId,
        user_id: log.userId,
        device_token_id: log.deviceTokenId || null,
        token: log.token,
        status: log.status,
        error_message: log.errorMessage || null,
        sent_at: log.sentAt || null,
        delivered_at: log.deliveredAt || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating push delivery log:', error);
      throw new Error('Failed to create push delivery log');
    }

    return this.mapToPushDeliveryLog(data);
  }

  async updateLogStatus(
    logId: string,
    status: PushDeliveryStatus,
    errorMessage?: string,
    deliveredAt?: string
  ): Promise<void> {
    const updateData: any = { status };
    
    if (errorMessage !== undefined) updateData.error_message = errorMessage;
    if (deliveredAt !== undefined) updateData.delivered_at = deliveredAt;
    if (status === 'sent' && !updateData.sent_at) {
      updateData.sent_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from('push_delivery_logs')
      .update(updateData)
      .eq('id', logId);

    if (error) {
      console.error('Error updating push delivery log:', error);
      throw new Error('Failed to update push delivery log');
    }
  }

  async getLogsByNotificationId(notificationId: string): Promise<PushDeliveryLog[]> {
    const { data, error } = await supabase
      .from('push_delivery_logs')
      .select('*')
      .eq('notification_id', notificationId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching push delivery logs:', error);
      throw new Error('Failed to fetch push delivery logs');
    }

    return (data || []).map(this.mapToPushDeliveryLog);
  }

  async getLogsByUserId(userId: string, limit: number = 50): Promise<PushDeliveryLog[]> {
    const { data, error } = await supabase
      .from('push_delivery_logs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching push delivery logs:', error);
      throw new Error('Failed to fetch push delivery logs');
    }

    return (data || []).map(this.mapToPushDeliveryLog);
  }

  private mapToPushDeliveryLog(data: any): PushDeliveryLog {
    return {
      id: data.id,
      notificationId: data.notification_id,
      userId: data.user_id,
      deviceTokenId: data.device_token_id,
      token: data.token,
      status: data.status as PushDeliveryStatus,
      errorMessage: data.error_message,
      sentAt: data.sent_at,
      deliveredAt: data.delivered_at,
      createdAt: data.created_at,
    };
  }
}
