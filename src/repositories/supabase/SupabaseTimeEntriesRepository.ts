import { TimeEntriesRepository } from '../../services/repositories/interfaces';
import { TimeEntry, EntryType } from '../../types';
import { supabase } from '../../services/supabase';
import {
  buildIsoFromDateAndTime,
  DAY_ADJUST_ENTRY_TYPES,
  entriesForDateKey,
  hasCompletedDayAdjustment,
} from '../../utils/point-day';
import { getEffectiveRecordedAt } from '../../utils/point-report-pdf';

const ENTRY_TYPE_TO_TIME_KEY: Record<EntryType, keyof {
  clockIn: string;
  clockOut: string;
  coffeeStart: string;
  coffeeEnd: string;
  lunchStart: string;
  lunchEnd: string;
}> = {
  clock_in: 'clockIn',
  clock_out: 'clockOut',
  coffee_start: 'coffeeStart',
  coffee_end: 'coffeeEnd',
  lunch_start: 'lunchStart',
  lunch_end: 'lunchEnd',
};

function mapRow(row: any): TimeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    recordedAt: row.recorded_at,
    entryType: row.entry_type ?? null,
    locationAddress: row.location_address ?? null,
    gpsAccuracy: row.gps_accuracy ?? null,
    gpsSource: row.gps_source ?? null,
    createdAt: row.created_at,
    isAdjusted: row.is_adjusted ?? false,
    adjustedRecordedAt: row.adjusted_recorded_at ?? null,
    adjustDescription: row.adjust_description ?? null,
    adjustedAt: row.adjusted_at ?? null,
    adjustedByUserId: row.adjusted_by_user_id ?? null,
  };
}

export class SupabaseTimeEntriesRepository implements TimeEntriesRepository {
  async createTimeEntry(entry: Omit<TimeEntry, 'id' | 'createdAt'>): Promise<TimeEntry> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    if (entry.userId !== user.id) throw new Error('Cannot create time entry for another user');

    const { data, error } = await supabase
      .from('time_entries')
      .insert({
        user_id: entry.userId,
        user_name: entry.userName,
        recorded_at: entry.recordedAt,
        entry_type: entry.entryType ?? null,
        location_address: entry.locationAddress ?? null,
        gps_accuracy: entry.gpsAccuracy ?? null,
        gps_source: entry.gpsSource ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating time entry:', error);
      throw new Error(error.message || 'Failed to create time entry');
    }
    return mapRow(data);
  }

  async getMyTimeEntries(
    userId: string,
    options?: { from?: string; to?: string }
  ): Promise<TimeEntry[]> {
    let q = supabase
      .from('time_entries')
      .select('*')
      .eq('user_id', userId)
      .order('recorded_at', { ascending: false });
    if (options?.from) q = q.gte('recorded_at', options.from);
    if (options?.to) q = q.lte('recorded_at', options.to);
    const { data, error } = await q;
    if (error) {
      console.error('Error fetching time entries:', error);
      throw new Error(error.message || 'Failed to fetch time entries');
    }
    return (data || []).map(mapRow);
  }

  async getAllTimeEntries(options?: {
    from?: string;
    to?: string;
    userId?: string;
  }): Promise<TimeEntry[]> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('User not authenticated');

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', authUser.id)
      .maybeSingle();

    const isMaster = !userError && userRow?.user_type === 'Master';
    const effectiveUserId = isMaster ? options?.userId : authUser.id;

    let q = supabase
      .from('time_entries')
      .select('*')
      .order('recorded_at', { ascending: false });
    if (effectiveUserId) q = q.eq('user_id', effectiveUserId);
    if (options?.from) q = q.gte('recorded_at', options.from);
    if (options?.to) q = q.lte('recorded_at', options.to);
    const { data, error } = await q;
    if (error) {
      console.error('Error fetching time entries:', error);
      throw new Error(error.message || 'Failed to fetch time entries');
    }
    return (data || []).map(mapRow);
  }

  async getServerTime(): Promise<string> {
    const { data, error } = await supabase.rpc('get_server_time');
    if (error) {
      console.warn('get_server_time RPC failed, using client time:', error.message);
      return new Date().toISOString();
    }
    return data ?? new Date().toISOString();
  }

  async updateTimeEntryAdjustment(
    entryId: string,
    payload: { adjustedRecordedAt: string; adjustDescription: string }
  ): Promise<TimeEntry> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('User not authenticated');

    const desc = payload.adjustDescription?.trim().slice(0, 20) ?? '';
    if (desc.length === 0) throw new Error('Descrição do ajuste é obrigatória');
    if (payload.adjustDescription.length > 20) throw new Error('Descrição deve ter no máximo 20 caracteres');

    const { data: entryRow, error: fetchError } = await supabase
      .from('time_entries')
      .select('*')
      .eq('id', entryId)
      .maybeSingle();
    if (fetchError || !entryRow) throw new Error('Registro de ponto não encontrado');

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', authUser.id)
      .maybeSingle();
    const isMaster = !userError && userRow?.user_type === 'Master';
    const isOwner = entryRow.user_id === authUser.id;
    if (!isMaster && !isOwner) throw new Error('Sem permissão para ajustar este ponto');

    if (entryRow.is_adjusted) throw new Error('Este ponto já foi ajustado');

    const { data: updated, error } = await supabase
      .from('time_entries')
      .update({
        is_adjusted: true,
        adjusted_recorded_at: payload.adjustedRecordedAt,
        adjust_description: desc,
        adjusted_at: new Date().toISOString(),
        adjusted_by_user_id: authUser.id,
      })
      .eq('id', entryId)
      .select()
      .single();
    if (error) {
      console.error('Error updating time entry adjustment:', error);
      throw new Error(error.message || 'Falha ao salvar ajuste');
    }
    return mapRow(updated);
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
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) throw new Error('User not authenticated');

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', authUser.id)
      .maybeSingle();
    const isMaster = !userError && userRow?.user_type === 'Master';
    const isOwner = payload.userId === authUser.id;
    if (!isMaster && !isOwner) throw new Error('Sem permissão para ajustar este ponto');

    const dayEntries = entriesForDateKey(
      payload.existingEntries,
      payload.userId,
      payload.dateKey
    );
    if (hasCompletedDayAdjustment(dayEntries)) {
      throw new Error('DAY_ALREADY_ADJUSTED');
    }

    const desc = payload.adjustDescription?.trim().slice(0, 20) ?? '';
    if (!desc) throw new Error('Descrição do ajuste é obrigatória');

    const findByType = (type: EntryType) =>
      dayEntries.find((e) => e.entryType === type) ?? null;

    const now = new Date().toISOString();

    for (const entryType of DAY_ADJUST_ENTRY_TYPES) {
      const timeKey = ENTRY_TYPE_TO_TIME_KEY[entryType];
      const timeStr = payload.times[timeKey];
      const adjustedIso = buildIsoFromDateAndTime(payload.dateKey, timeStr);
      const existing = findByType(entryType);

      if (existing) {
        const { error } = await supabase
          .from('time_entries')
          .update({
            is_adjusted: true,
            adjusted_recorded_at: adjustedIso,
            adjust_description: desc,
            adjusted_at: now,
            adjusted_by_user_id: authUser.id,
          })
          .eq('id', existing.id);
        if (error) throw new Error(error.message || 'Falha ao salvar ajuste');
      } else {
        const { error } = await supabase.from('time_entries').insert({
          user_id: payload.userId,
          user_name: payload.userName,
          recorded_at: adjustedIso,
          entry_type: entryType,
          location_address: null,
          gps_accuracy: null,
          gps_source: null,
          is_adjusted: true,
          adjusted_recorded_at: adjustedIso,
          adjust_description: desc,
          adjusted_at: now,
          adjusted_by_user_id: authUser.id,
        });
        if (error) throw new Error(error.message || 'Falha ao criar marcação ajustada');
      }
    }
  }
}
