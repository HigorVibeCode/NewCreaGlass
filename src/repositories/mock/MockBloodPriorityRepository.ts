import AsyncStorage from '@react-native-async-storage/async-storage';
import { BloodPriorityRepository } from '../../services/repositories/interfaces';
import { BloodPriorityMessage, BloodPriorityRead } from '../../types';

const STORAGE_KEY_MESSAGES = 'mock_blood_priority_messages';
const STORAGE_KEY_READS = 'mock_blood_priority_reads';

export class MockBloodPriorityRepository implements BloodPriorityRepository {
  private async getMessages(): Promise<BloodPriorityMessage[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_MESSAGES);
    if (!stored) return [];
    return JSON.parse(stored);
  }
  
  private async saveMessages(messages: BloodPriorityMessage[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_MESSAGES, JSON.stringify(messages));
  }
  
  private async getReads(): Promise<BloodPriorityRead[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_READS);
    if (!stored) return [];
    return JSON.parse(stored);
  }
  
  private async saveReads(reads: BloodPriorityRead[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_READS, JSON.stringify(reads));
  }
  
  async getAllMessages(): Promise<BloodPriorityMessage[]> {
    return this.getMessages();
  }
  
  async getMessageById(messageId: string): Promise<BloodPriorityMessage | null> {
    const messages = await this.getMessages();
    return messages.find(m => m.id === messageId) || null;
  }
  
  async createMessage(
    message: Omit<BloodPriorityMessage, 'id' | 'createdAt'>
  ): Promise<BloodPriorityMessage> {
    const messages = await this.getMessages();
    const newMessage: BloodPriorityMessage = {
      ...message,
      id: 'bp-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    messages.push(newMessage);
    await this.saveMessages(messages);
    return newMessage;
  }
  
  async deleteMessage(messageId: string): Promise<void> {
    const messages = await this.getMessages();
    await this.saveMessages(messages.filter(m => m.id !== messageId));
    const reads = await this.getReads();
    await this.saveReads(reads.filter(r => r.messageId !== messageId));
  }

  async getUserReads(userId: string): Promise<BloodPriorityRead[]> {
    const reads = await this.getReads();
    return reads.filter(r => r.userId === userId);
  }
  
  async getUnreadMessages(userId: string): Promise<BloodPriorityMessage[]> {
    const messages = await this.getMessages();
    const reads = await this.getUserReads(userId);
    const readMessageIds = reads
      .filter(r => r.confirmedAt)
      .map(r => r.messageId);
    
    return messages.filter(m => !readMessageIds.includes(m.id));
  }
  
  async openMessage(messageId: string, userId: string): Promise<BloodPriorityRead> {
    const reads = await this.getReads();
    const existing = reads.find(r => r.messageId === messageId && r.userId === userId);
    
    if (existing) {
      if (!existing.openedAt) {
        existing.openedAt = new Date().toISOString();
        await this.saveReads(reads);
      }
      return existing;
    }
    
    const newRead: BloodPriorityRead = {
      messageId,
      userId,
      openedAt: new Date().toISOString(),
      minTimerSeconds: 10,
    };
    reads.push(newRead);
    await this.saveReads(reads);
    return newRead;
  }
  
  async confirmRead(messageId: string, userId: string): Promise<void> {
    const reads = await this.getReads();
    const read = reads.find(r => r.messageId === messageId && r.userId === userId);
    if (read) {
      read.confirmedAt = new Date().toISOString();
      await this.saveReads(reads);
    }
  }
}
