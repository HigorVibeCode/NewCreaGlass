import { BloodPriorityRepository } from '../../services/repositories/interfaces';
import { BloodPriorityMessage, BloodPriorityRead } from '../../types';
import { supabase } from '../../services/supabase';

export class SupabaseBloodPriorityRepository implements BloodPriorityRepository {
  async getAllMessages(): Promise<BloodPriorityMessage[]> {
    const { data, error } = await supabase
      .from('blood_priority_messages')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching blood priority messages:', error);
      throw new Error('Failed to fetch blood priority messages');
    }

    return (data || []).map(this.mapToMessage);
  }

  async getMessageById(messageId: string): Promise<BloodPriorityMessage | null> {
    const { data, error } = await supabase
      .from('blood_priority_messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching blood priority message:', error);
      throw new Error('Failed to fetch blood priority message');
    }

    return data ? this.mapToMessage(data) : null;
  }

  async createMessage(
    message: Omit<BloodPriorityMessage, 'id' | 'createdAt'>
  ): Promise<BloodPriorityMessage> {
    // Get current authenticated user from Supabase session
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    // Use auth.uid() instead of message.createdBy to ensure RLS policy passes
    // RLS policy requires: auth.uid() = created_by
    const { data, error } = await supabase
      .from('blood_priority_messages')
      .insert({
        title: message.title,
        body: message.body,
        created_by: authUser.id, // Use auth.uid() from Supabase session
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating blood priority message:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      const errorMessage = error.message || 'Failed to create blood priority message';
      throw new Error(`Failed to create blood priority message: ${errorMessage}`);
    }

    return this.mapToMessage(data);
  }

  async deleteMessage(messageId: string): Promise<void> {
    const { error: readsError } = await supabase
      .from('blood_priority_reads')
      .delete()
      .eq('message_id', messageId);

    if (readsError) {
      console.error('Error deleting blood priority reads:', readsError);
    }

    const { error } = await supabase
      .from('blood_priority_messages')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('Error deleting blood priority message:', error);
      throw new Error('Failed to delete blood priority message');
    }
  }

  async getUserReads(userId: string): Promise<BloodPriorityRead[]> {
    const { data, error } = await supabase
      .from('blood_priority_reads')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching blood priority reads:', error);
      throw new Error('Failed to fetch blood priority reads');
    }

    return (data || []).map(this.mapToRead);
  }

  async getUnreadMessages(userId: string): Promise<BloodPriorityMessage[]> {
    const [allMessages, { data: reads }] = await Promise.all([
      this.getAllMessages(),
      supabase
        .from('blood_priority_reads')
        .select('message_id')
        .eq('user_id', userId)
        .not('confirmed_at', 'is', null),
    ]);

    const readMessageIds = new Set((reads || []).map((r: any) => r.message_id));
    return allMessages.filter(m => !readMessageIds.has(m.id));
  }

  async openMessage(messageId: string, userId: string): Promise<BloodPriorityRead> {
    // Check if read record exists
    const { data: existing } = await supabase
      .from('blood_priority_reads')
      .select('*')
      .eq('message_id', messageId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Update opened_at if not set
      if (!existing.opened_at) {
        const { data, error } = await supabase
          .from('blood_priority_reads')
          .update({ opened_at: new Date().toISOString() })
          .eq('message_id', messageId)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) {
          console.error('Error updating blood priority read:', error);
          throw new Error('Failed to update blood priority read');
        }

        return this.mapToRead(data);
      }
      return this.mapToRead(existing);
    }

    // Create new read record
    const { data, error } = await supabase
      .from('blood_priority_reads')
      .insert({
        message_id: messageId,
        user_id: userId,
        opened_at: new Date().toISOString(),
        min_timer_seconds: 10,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating blood priority read:', error);
      throw new Error('Failed to create blood priority read');
    }

    return this.mapToRead(data);
  }

  async confirmRead(messageId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('blood_priority_reads')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('message_id', messageId)
      .eq('user_id', userId);

    if (error) {
      console.error('Error confirming blood priority read:', error);
      throw new Error('Failed to confirm blood priority read');
    }
  }

  private mapToMessage(data: any): BloodPriorityMessage {
    return {
      id: data.id,
      title: data.title,
      body: data.body,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }

  private mapToRead(data: any): BloodPriorityRead {
    return {
      messageId: data.message_id,
      userId: data.user_id,
      openedAt: data.opened_at || undefined,
      confirmedAt: data.confirmed_at || undefined,
      minTimerSeconds: data.min_timer_seconds,
    };
  }
}
