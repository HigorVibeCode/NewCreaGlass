import { InventoryRepository } from '../../services/repositories/interfaces';
import { InventoryGroup, InventoryHistory, InventoryItem } from '../../types';
import { supabase } from '../../services/supabase';

export class SupabaseInventoryRepository implements InventoryRepository {
  async getAllGroups(): Promise<InventoryGroup[]> {
    const { data, error } = await supabase
      .from('inventory_groups')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching inventory groups:', error);
      throw new Error('Failed to fetch inventory groups');
    }

    return (data || []).map(this.mapToGroup);
  }

  async createGroup(group: Omit<InventoryGroup, 'id' | 'createdAt'>): Promise<InventoryGroup> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('inventory_groups')
      .insert({
        name: group.name,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating inventory group:', error);
      throw new Error('Failed to create inventory group');
    }

    return this.mapToGroup(data);
  }

  async getGroupById(groupId: string): Promise<InventoryGroup | null> {
    const { data, error } = await supabase
      .from('inventory_groups')
      .select('*')
      .eq('id', groupId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching inventory group:', error);
      throw new Error('Failed to fetch inventory group');
    }

    return data ? this.mapToGroup(data) : null;
  }

  async getItemsByGroup(groupId: string): Promise<InventoryItem[]> {
    // If groupId is a string like "group-glass", try to find the group by name
    let actualGroupId = groupId;
    
    if (groupId.startsWith('group-')) {
      // Convert old string IDs to actual group names
      const groupNameMap: Record<string, string> = {
        'group-glass': 'Glass',
        'group-supplies': 'Supplies',
        'group-spare-parts': 'Spare Parts',
      };
      
      const groupName = groupNameMap[groupId];
      if (groupName) {
        // Find the group by name to get its actual UUID
        const { data: groupData } = await supabase
          .from('inventory_groups')
          .select('id')
          .eq('name', groupName)
          .single();
        
        if (groupData?.id) {
          actualGroupId = groupData.id;
        } else {
          console.warn(`Group with name "${groupName}" not found, using original ID`);
        }
      }
    }

    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('group_id', actualGroupId)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching inventory items:', error);
      throw new Error('Failed to fetch inventory items');
    }

    return (data || []).map(this.mapToItem);
  }

  async getAllItems(): Promise<InventoryItem[]> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching all inventory items:', error);
      throw new Error('Failed to fetch inventory items');
    }

    return (data || []).map(this.mapToItem);
  }

  async getItemById(itemId: string): Promise<InventoryItem | null> {
    const { data, error } = await supabase
      .from('inventory_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching inventory item:', error);
      throw new Error('Failed to fetch inventory item');
    }

    return data ? this.mapToItem(data) : null;
  }

  async createItem(item: Omit<InventoryItem, 'id' | 'createdAt'>): Promise<InventoryItem> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('inventory_items')
      .insert({
        group_id: item.groupId,
        name: item.name,
        unit: item.unit,
        stock: item.stock,
        low_stock_threshold: item.lowStockThreshold,
        created_by: user.id,
        height: item.height,
        width: item.width,
        thickness: item.thickness,
        total_m2: item.totalM2,
        ideal_stock: item.idealStock,
        location: item.location,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating inventory item:', error);
      throw new Error('Failed to create inventory item');
    }

    return this.mapToItem(data);
  }

  async updateItem(itemId: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    // Get current item to check for stock threshold changes
    const currentItem = await this.getItemById(itemId);
    if (!currentItem) {
      throw new Error('Item not found');
    }

    const previousStock = currentItem.stock;
    const previousThreshold = currentItem.lowStockThreshold;

    const updateData: any = {};
    
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.unit !== undefined) updateData.unit = updates.unit;
    if (updates.stock !== undefined) updateData.stock = updates.stock;
    if (updates.lowStockThreshold !== undefined) updateData.low_stock_threshold = updates.lowStockThreshold;
    if (updates.height !== undefined) updateData.height = updates.height;
    if (updates.width !== undefined) updateData.width = updates.width;
    if (updates.thickness !== undefined) updateData.thickness = updates.thickness;
    if (updates.totalM2 !== undefined) updateData.total_m2 = updates.totalM2;
    if (updates.idealStock !== undefined) updateData.ideal_stock = updates.idealStock;
    if (updates.location !== undefined) updateData.location = updates.location;

    const { data, error } = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error updating inventory item:', error);
      throw new Error('Failed to update inventory item');
    }

    const updatedItem = this.mapToItem(data);
    const newStock = updatedItem.stock;
    const newThreshold = updatedItem.lowStockThreshold;

    // Check if stock reached minimum level and create notification
    // Only notify if stock just reached or went below threshold
    const stockChanged = updates.stock !== undefined && updates.stock !== previousStock;
    const thresholdChanged = updates.lowStockThreshold !== undefined && updates.lowStockThreshold !== previousThreshold;

    // Notify if:
    // 1. Stock was reduced and now is at or below threshold (and wasn't before)
    // 2. Threshold was lowered and stock is now at or below it (and wasn't before)
    const shouldNotify = (stockChanged && newStock <= newThreshold && previousStock > previousThreshold) ||
                         (thresholdChanged && newStock <= newThreshold && previousStock > previousThreshold);

    if (shouldNotify) {
      try {
        const { repos } = await import('../../services/container');
        await repos.notificationsRepo.createNotification({
          type: 'inventory.lowStock',
          payloadJson: {
            itemName: updatedItem.name,
            itemId: updatedItem.id,
            stock: newStock,
            threshold: newThreshold,
          },
          createdBySystem: true,
        });
      } catch (notifError) {
        console.error('Error creating low stock notification:', notifError);
        // Don't throw - notification is secondary, update was successful
      }
    }

    return updatedItem;
  }

  async deleteItem(itemId: string): Promise<void> {
    const { error } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', itemId);

    if (error) {
      console.error('Error deleting inventory item:', error);
      throw new Error('Failed to delete inventory item');
    }
  }

  async adjustStock(itemId: string, delta: number, userId: string): Promise<InventoryItem> {
    // Get current item
    const item = await this.getItemById(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    const previousValue = item.stock;
    const newValue = previousValue + delta;

    // Update stock
    const updatedItem = await this.updateItem(itemId, { stock: newValue });

    // Create history entry
    const { error: historyError } = await supabase
      .from('inventory_history')
      .insert({
        item_id: itemId,
        action: 'adjustStock',
        delta: delta,
        previous_value: previousValue,
        new_value: newValue,
        created_by: userId,
      });

    if (historyError) {
      console.error('Error creating inventory history entry:', historyError);
      // Don't throw - stock was updated successfully, history is secondary
    }

    // Check if stock reached minimum level and create notification
    if (newValue <= item.lowStockThreshold && previousValue > item.lowStockThreshold) {
      // Stock just reached or went below minimum threshold
      try {
        const { repos } = await import('../../services/container');
        await repos.notificationsRepo.createNotification({
          type: 'inventory.lowStock',
          payloadJson: {
            itemName: updatedItem.name,
            itemId: updatedItem.id,
            stock: newValue,
            threshold: item.lowStockThreshold,
          },
          createdBySystem: true,
        });
      } catch (notifError) {
        console.error('Error creating low stock notification:', notifError);
      }
    }

    return updatedItem;
  }

  async getItemHistory(itemId: string): Promise<InventoryHistory[]> {
    const { data, error } = await supabase
      .from('inventory_history')
      .select('*')
      .eq('item_id', itemId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching inventory history:', error);
      throw new Error('Failed to fetch inventory history');
    }

    return (data || []).map(this.mapToHistory);
  }

  private mapToGroup(data: any): InventoryGroup {
    return {
      id: data.id,
      name: data.name,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }

  private mapToItem(data: any): InventoryItem {
    return {
      id: data.id,
      groupId: data.group_id,
      name: data.name,
      unit: data.unit,
      stock: data.stock,
      lowStockThreshold: data.low_stock_threshold,
      createdBy: data.created_by,
      createdAt: data.created_at,
      height: data.height,
      width: data.width,
      thickness: data.thickness,
      totalM2: data.total_m2,
      idealStock: data.ideal_stock,
      location: data.location,
    };
  }

  private mapToHistory(data: any): InventoryHistory {
    return {
      id: data.id,
      itemId: data.item_id,
      action: data.action,
      delta: data.delta,
      previousValue: data.previous_value,
      newValue: data.new_value,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }
}
