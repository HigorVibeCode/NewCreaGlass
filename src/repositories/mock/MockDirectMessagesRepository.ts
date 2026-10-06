import { DirectMessagesRepository } from '../../services/repositories/interfaces';
import { MailboxRow, UserDirectMessage, UserDirectMessageDetail } from '../../types';

export class MockDirectMessagesRepository implements DirectMessagesRepository {
  async getUnreadCount(): Promise<number> {
    return 0;
  }

  async getReceivedMessages(): Promise<MailboxRow[]> {
    return [];
  }

  async getSentMessages(): Promise<MailboxRow[]> {
    return [];
  }

  async getMessageById(_messageId: string): Promise<UserDirectMessageDetail | null> {
    return null;
  }

  async sendMessage(_recipientId: string, _body: string): Promise<UserDirectMessage> {
    throw new Error('Direct messages require Supabase backend');
  }

  async markMessageRead(_messageId: string): Promise<void> {}
}
