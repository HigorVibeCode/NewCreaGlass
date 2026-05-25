import AsyncStorage from '@react-native-async-storage/async-storage';
import { TimeEntriesRepository } from '../../services/repositories/interfaces';
import { TimeEntry, EntryType } from '../../types';
import {
  buildIsoFromDateAndTime,
  DAY_ADJUST_ENTRY_TYPES,
  entriesForDateKey,
  hasCompletedDayAdjustment,
} from '../../utils/point-day';

const ENTRY_TYPE_TO_TIME_KEY: Record<EntryType, 'clockIn' | 'clockOut' | 'coffeeStart' | 'coffeeEnd' | 'lunchStart' | 'lunchEnd'> = {
  clock_in: 'clockIn',
  clock_out: 'clockOut',
  coffee_start: 'coffeeStart',
  coffee_end: 'coffeeEnd',
  lunch_start: 'lunchStart',
  lunch_end: 'lunchEnd',
};

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

  async saveDayTimeAdjustment(payload: {
    userId: string;
    userName: string;
    dateKey: string;
    adjustDescription: string;
    times: {
      clockIn: string;
      clockOut: string;
      coffeeStart: string;
      coffeeEnd: string;
      lunchStart: string;
      lunchEnd: string;
    };
    existingEntries: TimeEntry[];
  }): Promise<void> {
    const dayEntries = entriesForDateKey(
      payload.existingEntries,
      payload.userId,
      payload.dateKey
    );
    if (hasCompletedDayAdjustment(dayEntries)) throw new Error('DAY_ALREADY_ADJUSTED');

    const desc = payload.adjustDescription?.trim().slice(0, 20) ?? '';
    if (!desc) throw new Error('Descrição do ajuste é obrigatória');

    const entries = await this.getEntries();
    const now = new Date().toISOString();
    const findByType = (type: EntryType) =>
      dayEntries.find((e) => e.entryType === type) ?? null;

    for (const entryType of DAY_ADJUST_ENTRY_TYPES) {
      const timeKey = ENTRY_TYPE_TO_TIME_KEY[entryType];
      const adjustedIso = buildIsoFromDateAndTime(payload.dateKey, payload.times[timeKey]);
      const existing = findByType(entryType);

      if (existing) {
        const idx = entries.findIndex((e) => e.id === existing.id);
        if (idx === -1) continue;
        entries[idx] = {
          ...entries[idx],
          isAdjusted: true,
          adjustedRecordedAt: adjustedIso,
          adjustDescription: desc,
          adjustedAt: now,
          adjustedByUserId: payload.userId,
        };
      } else {
        entries.unshift({
          id: 'te-' + Date.now() + '-' + entryType,
          userId: payload.userId,
          userName: payload.userName,
          recordedAt: adjustedIso,
          entryType,
          locationAddress: null,
          gpsAccuracy: null,
          gpsSource: null,
          createdAt: now,
          isAdjusted: true,
          adjustedRecordedAt: adjustedIso,
          adjustDescription: desc,
          adjustedAt: now,
          adjustedByUserId: payload.userId,
        });
      }
    }
    await this.saveEntries(entries);
  }
}
