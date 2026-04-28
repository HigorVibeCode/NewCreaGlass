import { DirectMessagesRepository } from '../../services/repositories/interfaces';
import { MailboxRow, UserDirectMessage, UserDirectMessageDetail } from '../../types';
import { supabase } from '../../services/supabase';

const PREVIEW_LEN = 160;

function previewText(body: string): string {
  const t = body.replace(/\s+/g, ' ').trim();
  if (t.length <= PREVIEW_LEN) return t;
  return `${t.slice(0, PREVIEW_LEN)}…`;
}

export class SupabaseDirectMessagesRepository implements DirectMessagesRepository {
  private async getAuthUserId(): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
  }

  private mapRow(row: any): UserDirectMessage {
    return {
      id: row.id,
      senderId: row.sender_id,
      recipientId: row.recipient_id,
      body: row.body,
      readAt: row.read_at ?? undefined,
      createdAt: row.created_at,
    };
  }

  private async usernameMap(ids: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0) return new Map();
    const { data, error } = await supabase.from('users').select('id, username').in('id', unique);
    if (error) {
      console.error('usernameMap:', error);
      return new Map();
    }
    return new Map((data || []).map((u: any) => [u.id as string, u.username as string]));
  }

  async getUnreadCount(): Promise<number> {
    const uid = await this.getAuthUserId();
    const { count, error } = await supabase
      .from('user_direct_messages')
      .select('id', { count: 'exact', head: true })
      .eq('recipient_id', uid)
      .is('read_at', null);

    if (error) {
      console.error('getUnreadCount direct messages:', error);
      throw new Error('Failed to fetch unread count');
    }
    return count ?? 0;
  }

  async getReceivedMessages(): Promise<MailboxRow[]> {
    const uid = await this.getAuthUserId();
    const { data: rows, error } = await supabase
      .from('user_direct_messages')
      .select('*')
      .eq('recipient_id', uid)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      console.error('getReceivedMessages:', error);
      throw new Error('Failed to load inbox');
    }

    const list = rows || [];
    const names = await this.usernameMap(list.map((r: any) => r.sender_id));
    return list.map((r: any) => ({
      id: r.id,
      body: r.body,
      preview: previewText(r.body),
      createdAt: r.created_at,
      readAt: r.read_at ?? undefined,
      counterpartId: r.sender_id,
      counterpartName: names.get(r.sender_id) || r.sender_id.slice(0, 8),
      direction: 'received' as const,
    }));
  }

  async getSentMessages(): Promise<MailboxRow[]> {
    const uid = await this.getAuthUserId();
    const { data: rows, error } = await supabase
      .from('user_direct_messages')
      .select('*')
      .eq('sender_id', uid)
      .order('created_at', { ascending: false })
      .limit(300);

    if (error) {
      console.error('getSentMessages:', error);
      throw new Error('Failed to load sent messages');
    }

    const list = rows || [];
    const names = await this.usernameMap(list.map((r: any) => r.recipient_id));
    return list.map((r: any) => ({
      id: r.id,
      body: r.body,
      preview: previewText(r.body),
      createdAt: r.created_at,
      readAt: r.read_at ?? undefined,
      counterpartId: r.recipient_id,
      counterpartName: names.get(r.recipient_id) || r.recipient_id.slice(0, 8),
      direction: 'sent' as const,
    }));
  }

  async getMessageById(messageId: string): Promise<UserDirectMessageDetail | null> {
    const { data: row, error } = await supabase
      .from('user_direct_messages')
      .select('*')
      .eq('id', messageId)
      .maybeSingle();

    if (error) {
      console.error('getMessageById:', error);
      throw new Error('Failed to load message');
    }
    if (!row) return null;

    const base = this.mapRow(row);
    const names = await this.usernameMap([base.senderId, base.recipientId]);
    return {
      ...base,
      senderName: names.get(base.senderId) || base.senderId.slice(0, 8),
      recipientName: names.get(base.recipientId) || base.recipientId.slice(0, 8),
    };
  }

  async sendMessage(recipientId: string, body: string): Promise<UserDirectMessage> {
    const trimmed = body.trim();
    if (!trimmed) {
      throw new Error('Message is empty');
    }
    const uid = await this.getAuthUserId();
    if (recipientId === uid) {
      throw new Error('Cannot message yourself');
    }

    const { data: recipient } = await supabase
      .from('users')
      .select('id, is_active')
      .eq('id', recipientId)
      .maybeSingle();

    if (!recipient?.is_active) {
      throw new Error('Recipient is not active');
    }

    const { data, error } = await supabase
      .from('user_direct_messages')
      .insert({
        sender_id: uid,
        recipient_id: recipientId,
        body: trimmed,
      })
      .select()
      .single();

    if (error) {
      console.error('sendMessage:', error);
      throw new Error(error.message || 'Failed to send message');
    }

    return this.mapRow(data);
  }

  async markMessageRead(messageId: string): Promise<void> {
    const uid = await this.getAuthUserId();
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('user_direct_messages')
      .update({ read_at: now })
      .eq('id', messageId)
      .eq('recipient_id', uid)
      .is('read_at', null);

    if (error) {
      console.error('markMessageRead:', error);
      throw new Error('Failed to mark message as read');
    }
  }
}
