import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProductionRepository } from '../../services/repositories/interfaces';
import { Production, ProductionStatus, ProductionStatusHistory } from '../../types';

const STORAGE_KEY = 'mock_production';
const STORAGE_KEY_HISTORY = 'mock_production_status_history';

export class MockProductionRepository implements ProductionRepository {
  private async getProductions(): Promise<Production[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  }
  
  private async saveProductions(productions: Production[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(productions));
  }

  private async getAllStatusHistory(): Promise<ProductionStatusHistory[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_HISTORY);
    if (!stored) return [];
    return JSON.parse(stored);
  }

  private async saveStatusHistory(history: ProductionStatusHistory[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  }
  
  async getAllProductions(status?: ProductionStatus): Promise<Production[]> {
    const productions = await this.getProductions();
    if (status) {
      return productions.filter(p => p.status === status);
    }
    return productions;
  }
  
  async getProductionById(productionId: string): Promise<Production | null> {
    const productions = await this.getProductions();
    return productions.find(p => p.id === productionId) || null;
  }
  
  async createProduction(
    production: Omit<Production, 'id' | 'createdAt'>
  ): Promise<Production> {
    const productions = await this.getProductions();
    const newProduction: Production = {
      ...production,
      id: 'prod-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    productions.push(newProduction);
    await this.saveProductions(productions);
    return newProduction;
  }

  async updateProduction(productionId: string, updates: Partial<Production>, changedBy?: string): Promise<Production> {
    const productions = await this.getProductions();
    const index = productions.findIndex(p => p.id === productionId);
    if (index === -1) {
      throw new Error('Production not found');
    }
    const previousProduction = productions[index];
    const previousStatus = previousProduction.status;
    
    productions[index] = { ...productions[index], ...updates };
    await this.saveProductions(productions);
    
    // Save status history if status changed
    if (updates.status && updates.status !== previousStatus && changedBy) {
      const history = await this.getAllStatusHistory();
      const historyEntry: ProductionStatusHistory = {
        id: 'hist-' + Date.now(),
        productionId,
        previousStatus,
        newStatus: updates.status,
        changedBy,
        changedAt: new Date().toISOString(),
      };
      history.push(historyEntry);
      await this.saveStatusHistory(history);
    }
    
    return productions[index];
  }

  async deleteProduction(productionId: string): Promise<void> {
    const productions = await this.getProductions();
    const filtered = productions.filter(p => p.id !== productionId);
    await this.saveProductions(filtered);
  }

  async getStatusHistory(productionId: string): Promise<ProductionStatusHistory[]> {
    const history = await this.getAllStatusHistory();
    return history.filter(h => h.productionId === productionId).sort((a, b) => 
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );
  }
}
