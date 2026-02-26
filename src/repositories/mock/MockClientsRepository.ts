import { ClientsRepository } from '../../services/repositories/interfaces';
import { Client } from '../../types';

const nowIso = () => new Date().toISOString();

export class MockClientsRepository implements ClientsRepository {
  private clients: Client[] = [];

  async getAllClients(search?: string): Promise<Client[]> {
    const term = (search || '').trim().toLowerCase();
    const active = this.clients.filter((c) => c.isActive);
    if (!term) return active.sort((a, b) => a.name.localeCompare(b.name));
    return active
      .filter((c) => c.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getClientById(clientId: string): Promise<Client | null> {
    return this.clients.find((c) => c.id === clientId) || null;
  }

  async createClient(client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Promise<Client> {
    const created: Client = {
      id: `mock-client-${Date.now()}`,
      name: client.name,
      address: client.address,
      contact: client.contact,
      isActive: client.isActive ?? true,
      createdBy: client.createdBy,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    this.clients.push(created);
    return created;
  }

  async updateClient(clientId: string, updates: Partial<Client>): Promise<Client> {
    const index = this.clients.findIndex((c) => c.id === clientId);
    if (index < 0) throw new Error('Client not found');
    this.clients[index] = {
      ...this.clients[index],
      ...updates,
      updatedAt: nowIso(),
    };
    return this.clients[index];
  }

  async deleteClient(clientId: string): Promise<void> {
    const index = this.clients.findIndex((c) => c.id === clientId);
    if (index < 0) return;
    this.clients[index] = {
      ...this.clients[index],
      isActive: false,
      updatedAt: nowIso(),
    };
  }
}
