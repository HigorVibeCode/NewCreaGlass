import { TimeEntriesRepository } from '../../services/repositories/interfaces';
import { TimeEntry } from '../../types';
import { supabase } from '../../services/supabase';

const ADJUSTMENT_MAX_DAYS = 2;

function mapRow(row: any): TimeEntry {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    recordedAt: row.recorded_at,
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
      .single();

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
      .single();
    if (fetchError || !entryRow) throw new Error('Registro de ponto não encontrado');

    const { data: userRow, error: userError } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', authUser.id)
      .single();
    const isMaster = !userError && userRow?.user_type === 'Master';
    const isOwner = entryRow.user_id === authUser.id;
    if (!isMaster && !isOwner) throw new Error('Sem permissão para ajustar este ponto');

    if (entryRow.is_adjusted) throw new Error('Este ponto já foi ajustado');

    const createdAt = new Date(entryRow.created_at).getTime();
    const twoDaysAgo = Date.now() - ADJUSTMENT_MAX_DAYS * 24 * 60 * 60 * 1000;
    if (createdAt < twoDaysAgo) throw new Error('Ajuste permitido apenas para pontos criados há menos de 2 dias');

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
}
