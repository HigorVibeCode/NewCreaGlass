import { Platform } from 'react-native';
import { InventoryRepository } from '../../services/repositories/interfaces';
import { InventoryGroup, InventoryHistory, InventoryItem, InventoryItemImage } from '../../types';
import { supabase } from '../../services/supabase';

const BUCKET_NAME = 'documents';
const INVENTORY_IMAGES_PREFIX = 'inventory-items';

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

    const items = (data || []).map(this.mapToItem);
    await this.attachImagesToItems(items);
    return items;
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

    const items = (data || []).map(this.mapToItem);
    await this.attachImagesToItems(items);
    return items;
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

    if (!data) return null;
    const item = this.mapToItem(data);
    await this.attachImagesToItems([item]);
    return item;
  }

  async createItem(item: Omit<InventoryItem, 'id' | 'createdAt'>): Promise<InventoryItem> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const insertData: any = {
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
    };

    // Only include supplier and reference_number if they have values
    if (item.supplier) {
      insertData.supplier = item.supplier;
    }
    if (item.referenceNumber) {
      insertData.reference_number = item.referenceNumber;
    }
    // Supplies-specific
    if (item.position != null && item.position !== '') insertData.position = item.position;
    if (item.color != null && item.color !== '') insertData.color = item.color;
    if (item.type != null && item.type !== '') insertData.type = item.type;
    if (item.opoOeschgerCode != null && item.opoOeschgerCode !== '') insertData.opo_oeschger_code = item.opoOeschgerCode;

    console.log('Inserting inventory item with data:', insertData);

    let { data, error } = await supabase
      .from('inventory_items')
      .insert(insertData)
      .select()
      .single();

    // If error is about missing columns, remove them and retry
    const missingColumnMsg = error?.message ?? '';
    const needsRetry =
      error &&
      error.code === 'PGRST204' &&
      (missingColumnMsg.includes('supplier') ||
        missingColumnMsg.includes('reference_number') ||
        missingColumnMsg.includes('position') ||
        missingColumnMsg.includes('color') ||
        missingColumnMsg.includes('opo_oeschger_code') ||
        missingColumnMsg.includes('type'));
    if (needsRetry) {
      console.warn('Some columns may not exist. Removing from insert and retrying...', missingColumnMsg);
      const {
        supplier,
        reference_number,
        position,
        color,
        type,
        opo_oeschger_code,
        ...insertDataWithoutOptionalColumns
      } = insertData;
      ({ data, error } = await supabase
        .from('inventory_items')
        .insert(insertDataWithoutOptionalColumns)
        .select()
        .single());
      if (!error) {
        console.warn('Insert succeeded without optional columns. Apply migration to enable all fields.');
      }
    }

    if (error) {
      console.error('Error creating inventory item:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to create inventory item: ${error.message}`);
    }

    console.log('Item created, response data:', data);
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
    // Handle supplier - set to NULL if undefined or empty string
    // Note: Only include if columns exist in database (migration must be applied)
    if (updates.supplier !== undefined) {
      updateData.supplier = updates.supplier && updates.supplier.trim() ? updates.supplier.trim() : null;
    }
    // Handle referenceNumber - set to NULL if undefined or empty string
    // Note: Only include if columns exist in database (migration must be applied)
    if (updates.referenceNumber !== undefined) {
      updateData.reference_number = updates.referenceNumber && updates.referenceNumber.trim() ? updates.referenceNumber.trim() : null;
    }
    if (updates.position !== undefined) updateData.position = updates.position?.trim() || null;
    if (updates.color !== undefined) updateData.color = updates.color?.trim() || null;
    if (updates.type !== undefined) updateData.type = updates.type?.trim() || null;
    if (updates.opoOeschgerCode !== undefined) updateData.opo_oeschger_code = updates.opoOeschgerCode?.trim() || null;

    console.log('Updating inventory item with data:', updateData);

    // If error mentions missing columns, remove them from updateData and retry
    let { data, error } = await supabase
      .from('inventory_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    // If error is about missing columns, remove them and retry
    const updateErrMsg = error?.message ?? '';
    const updateNeedsRetry =
      error &&
      error.code === 'PGRST204' &&
      (updateErrMsg.includes('supplier') ||
        updateErrMsg.includes('reference_number') ||
        updateErrMsg.includes('position') ||
        updateErrMsg.includes('color') ||
        updateErrMsg.includes('type') ||
        updateErrMsg.includes('opo_oeschger_code'));
    if (updateNeedsRetry) {
      console.warn('Some columns may not exist. Removing from update and retrying...', updateErrMsg);
      const {
        supplier,
        reference_number,
        position,
        color,
        type,
        opo_oeschger_code,
        ...updateDataWithoutOptionalColumns
      } = updateData;
      ({ data, error } = await supabase
        .from('inventory_items')
        .update(updateDataWithoutOptionalColumns)
        .eq('id', itemId)
        .select()
        .single());
      if (!error) {
        console.warn('Update succeeded without optional columns. Apply migration to enable all fields.');
      }
    }

    if (error) {
      console.error('Error updating inventory item:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      throw new Error(`Failed to update inventory item: ${error.message}`);
    }

    console.log('Item updated, response data:', data);

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
      supplier: data.supplier,
      referenceNumber: data.reference_number,
      position: data.position,
      color: data.color,
      type: data.type,
      opoOeschgerCode: data.opo_oeschger_code,
    };
  }

  private async attachImagesToItems(items: InventoryItem[]): Promise<void> {
    if (items.length === 0) return;
    const ids = items.map((i) => i.id);
    const { data: imagesData } = await supabase
      .from('inventory_item_images')
      .select('*')
      .in('item_id', ids)
      .order('is_main', { ascending: false })
      .order('sort_order', { ascending: true });
    const allImages = (imagesData || []).map((row: any) => this.mapToItemImage(row));
    for (const item of items) {
      item.images = allImages.filter((im) => im.itemId === item.id);
    }
  }

  async addItemImage(
    itemId: string,
    file: { uri: string; name: string; type: string },
    isMain = false
  ): Promise<InventoryItemImage> {
    const { data: existing } = await supabase
      .from('inventory_item_images')
      .select('id')
      .eq('item_id', itemId);
    if (existing && existing.length >= 3) {
      throw new Error('Maximum of 3 images per item');
    }
    const sortOrder = existing?.length ?? 0;
    const ext = file.name.split('.').pop()?.toLowerCase() || (file.type?.includes('png') ? 'png' : 'jpg');
    const uniquePath = `${INVENTORY_IMAGES_PREFIX}/${itemId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;

    let fileData: Blob | Uint8Array;
    const fileUri = file.uri;
    const mimeType = file.type || (ext === 'png' ? 'image/png' : 'image/jpeg');

    if (Platform.OS === 'web' || typeof fetch !== 'undefined') {
      const response = await fetch(fileUri);
      fileData = await response.blob();
    } else if (fileUri.startsWith('file://') || fileUri.startsWith('content://')) {
      const { File } = require('expo-file-system');
      const sourceFile = new File(fileUri);
      const base64 = await sourceFile.base64();
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      fileData = new Uint8Array(byteNumbers);
    } else {
      throw new Error('Unsupported file type or environment');
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(uniquePath, fileData, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error('Error uploading inventory item image:', uploadError);
      throw new Error(`Failed to upload image: ${uploadError.message}`);
    }

    if (isMain) {
      await supabase
        .from('inventory_item_images')
        .update({ is_main: false })
        .eq('item_id', itemId);
    }

    const { data: row, error: insertError } = await supabase
      .from('inventory_item_images')
      .insert({ item_id: itemId, storage_path: uniquePath, sort_order: sortOrder, is_main: isMain })
      .select()
      .single();

    if (insertError) {
      await supabase.storage.from(BUCKET_NAME).remove([uniquePath]);
      throw new Error(`Failed to save image record: ${insertError.message}`);
    }
    return this.mapToItemImage(row);
  }

  async deleteItemImage(imageId: string): Promise<void> {
    const { data: row, error: fetchError } = await supabase
      .from('inventory_item_images')
      .select('storage_path')
      .eq('id', imageId)
      .single();
    if (fetchError || !row) {
      throw new Error('Image not found');
    }
    const { error: deleteError } = await supabase.from('inventory_item_images').delete().eq('id', imageId);
    if (deleteError) throw new Error(`Failed to delete image: ${deleteError.message}`);
    await supabase.storage.from(BUCKET_NAME).remove([row.storage_path]);
  }

  async setMainItemImage(imageId: string): Promise<void> {
    const { data: row } = await supabase
      .from('inventory_item_images')
      .select('item_id')
      .eq('id', imageId)
      .single();
    if (!row) throw new Error('Image not found');
    await supabase
      .from('inventory_item_images')
      .update({ is_main: false })
      .eq('item_id', row.item_id);
    const { error } = await supabase
      .from('inventory_item_images')
      .update({ is_main: true })
      .eq('id', imageId);
    if (error) throw new Error(`Failed to set main image: ${error.message}`);
  }

  async getItemImageUrlSigned(storagePath: string): Promise<string> {
    if (!storagePath) return '';
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) return storagePath;
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 3600);
    if (error) {
      console.warn('[SupabaseInventoryRepository] getItemImageUrlSigned error:', error);
      return '';
    }
    return data?.signedUrl ?? '';
  }

  private mapToItemImage(data: any): InventoryItemImage {
    return {
      id: data.id,
      itemId: data.item_id,
      storagePath: data.storage_path,
      sortOrder: data.sort_order ?? 0,
      isMain: data.is_main ?? false,
      createdAt: data.created_at,
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
