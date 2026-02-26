import { ClientsRepository } from '../../services/repositories/interfaces';
import { Client } from '../../types';
import { supabase } from '../../services/supabase';

export class SupabaseClientsRepository implements ClientsRepository {
  async getAllClients(search?: string): Promise<Client[]> {
    let query = supabase
      .from('clients')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (search && search.trim()) {
      query = query.ilike('name', `%${search.trim()}%`);
    }

    const { data, error } = await query;
    if (error) {
      console.error('Error fetching clients:', error);
      throw new Error('Failed to fetch clients');
    }

    return (data || []).map(this.mapToClient);
  }

  async getClientById(clientId: string): Promise<Client | null> {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('id', clientId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching client by id:', error);
      throw new Error('Failed to fetch client');
    }

    return data ? this.mapToClient(data) : null;
  }

  async createClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('clients')
      .insert({
        name: client.name.trim(),
        address: client.address?.trim() || null,
        contact: client.contact?.trim() || null,
        is_active: client.isActive ?? true,
        created_by: user.id,
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error creating client:', error);
      throw new Error('Failed to create client');
    }

    return this.mapToClient(data);
  }

  async updateClient(clientId: string, updates: Partial<Client>): Promise<Client> {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name.trim();
    if (updates.address !== undefined) updateData.address = updates.address?.trim() || null;
    if (updates.contact !== undefined) updateData.contact = updates.contact?.trim() || null;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('id', clientId)
      .select('*')
      .single();

    if (error) {
      console.error('Error updating client:', error);
      throw new Error('Failed to update client');
    }

    return this.mapToClient(data);
  }

  async deleteClient(clientId: string): Promise<void> {
    // Soft-delete to keep historical links safe
    const { error } = await supabase
      .from('clients')
      .update({ is_active: false })
      .eq('id', clientId);

    if (error) {
      console.error('Error deleting client:', error);
      throw new Error('Failed to delete client');
    }
  }

  private mapToClient(data: any): Client {
    return {
      id: data.id,
      name: data.name,
      address: data.address || undefined,
      contact: data.contact || undefined,
      isActive: data.is_active ?? true,
      createdBy: data.created_by || undefined,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }
}
