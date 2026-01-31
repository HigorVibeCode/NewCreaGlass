import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimeEntriesRepository } from '../../services/repositories/interfaces';
import { TimeEntry } from '../../types';

const STORAGE_KEY = 'mock_time_entries';

export class MockTimeEntriesRepository implements TimeEntriesRepository {
  private async getEntries(): Promise<TimeEntry[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const raw = JSON.parse(stored) as any[];
    return raw.map((e) => ({
      ...e,
      isAdjusted: e.isAdjusted ?? false,
      adjustedRecordedAt: e.adjustedRecordedAt ?? null,
      adjustDescription: e.adjustDescription ?? null,
      adjustedAt: e.adjustedAt ?? null,
      adjustedByUserId: e.adjustedByUserId ?? null,
    }));
  }

  private async saveEntries(entries: TimeEntry[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  async createTimeEntry(entry: Omit<TimeEntry, 'id' | 'createdAt'>): Promise<TimeEntry> {
    const entries = await this.getEntries();
    const newEntry: TimeEntry = {
      ...entry,
      id: 'te-' + Date.now(),
      createdAt: new Date().toISOString(),
      isAdjusted: false,
      adjustedRecordedAt: null,
      adjustDescription: null,
      adjustedAt: null,
      adjustedByUserId: null,
    };
    entries.unshift(newEntry);
    await this.saveEntries(entries);
    return newEntry;
  }

  async getMyTimeEntries(
    userId: string,
    options?: { from?: string; to?: string }
  ): Promise<TimeEntry[]> {
    let list = (await this.getEntries()).filter((e) => e.userId === userId);
    if (options?.from) list = list.filter((e) => e.recordedAt >= options.from!);
    if (options?.to) list = list.filter((e) => e.recordedAt <= options.to!);
    return list.sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
  }

  async getAllTimeEntries(options?: {
    from?: string;
    to?: string;
    userId?: string;
  }): Promise<TimeEntry[]> {
    let list = await this.getEntries();
    if (options?.userId) list = list.filter((e) => e.userId === options.userId);
    if (options?.from) list = list.filter((e) => e.recordedAt >= options.from!);
    if (options?.to) list = list.filter((e) => e.recordedAt <= options.to!);
    return list.sort(
      (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime()
    );
  }

  async getServerTime(): Promise<string> {
    return new Date().toISOString();
  }

  async updateTimeEntryAdjustment(
    entryId: string,
    payload: { adjustedRecordedAt: string; adjustDescription: string }
  ): Promise<TimeEntry> {
    const entries = await this.getEntries();
    const idx = entries.findIndex((e) => e.id === entryId);
    if (idx === -1) throw new Error('Registro de ponto não encontrado');
    const desc = payload.adjustDescription?.trim().slice(0, 20) ?? '';
    if (!desc) throw new Error('Descrição do ajuste é obrigatória');
    const entry = entries[idx];
    if (entry.isAdjusted) throw new Error('Este ponto já foi ajustado');
    const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
    if (new Date(entry.createdAt).getTime() < twoDaysAgo) {
      throw new Error('Ajuste permitido apenas para pontos criados há menos de 2 dias');
    }
    const updated: TimeEntry = {
      ...entry,
      isAdjusted: true,
      adjustedRecordedAt: payload.adjustedRecordedAt,
      adjustDescription: desc,
      adjustedAt: new Date().toISOString(),
      adjustedByUserId: entry.userId,
    };
    entries[idx] = updated;
    await this.saveEntries(entries);
    return updated;
  }
}
