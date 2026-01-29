import AsyncStorage from '@react-native-async-storage/async-storage';
import { InventoryRepository } from '../../services/repositories/interfaces';
import { InventoryGroup, InventoryHistory, InventoryItem, InventoryItemImage } from '../../types';

const STORAGE_KEY_GROUPS = 'mock_inventory_groups';
const STORAGE_KEY_ITEMS = 'mock_inventory_items';
const STORAGE_KEY_HISTORY = 'mock_inventory_history';
const STORAGE_KEY_ITEM_IMAGES = 'mock_inventory_item_images';

export class MockInventoryRepository implements InventoryRepository {
  private async getGroups(): Promise<InventoryGroup[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_GROUPS);
    if (!stored) {
      // Initialize with 3 fixed groups
      const fixedGroups: InventoryGroup[] = [
        {
          id: 'group-glass',
          name: 'Glass',
          createdBy: 'system',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'group-supplies',
          name: 'Supplies',
          createdBy: 'system',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'group-spare-parts',
          name: 'Spare Parts',
          createdBy: 'system',
          createdAt: new Date().toISOString(),
        },
      ];
      await this.saveGroups(fixedGroups);
      return fixedGroups;
    }
    return JSON.parse(stored);
  }
  
  private async saveGroups(groups: InventoryGroup[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_GROUPS, JSON.stringify(groups));
  }
  
  async getAllGroups(): Promise<InventoryGroup[]> {
    // Always return the 3 fixed groups
    return [
      {
        id: 'group-glass',
        name: 'Glass',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'group-supplies',
        name: 'Supplies',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'group-spare-parts',
        name: 'Spare Parts',
        createdBy: 'system',
        createdAt: new Date().toISOString(),
      },
    ];
  }
  
  async createGroup(group: Omit<InventoryGroup, 'id' | 'createdAt'>): Promise<InventoryGroup> {
    // Groups cannot be created - they are fixed
    throw new Error('Cannot create groups - only 3 fixed groups exist');
  }
  
  private async getItems(): Promise<InventoryItem[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_ITEMS);
    if (!stored) return [];
    return JSON.parse(stored);
  }
  
  private async saveItems(items: InventoryItem[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_ITEMS, JSON.stringify(items));
  }
  
  private async getHistory(): Promise<InventoryHistory[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_HISTORY);
    if (!stored) return [];
    return JSON.parse(stored);
  }
  
  private async saveHistory(history: InventoryHistory[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  }
  
  async getGroupById(groupId: string): Promise<InventoryGroup | null> {
    const groups = await this.getAllGroups();
    return groups.find(g => g.id === groupId) || null;
  }
  
  async getItemsByGroup(groupId: string): Promise<InventoryItem[]> {
    const items = await this.getItems();
    const filtered = items.filter(i => i.groupId === groupId);
    await this.attachImagesToItems(filtered);
    return filtered;
  }
  
  async getAllItems(): Promise<InventoryItem[]> {
    const items = await this.getItems();
    await this.attachImagesToItems(items);
    return items;
  }
  
  async getItemById(itemId: string): Promise<InventoryItem | null> {
    const items = await this.getItems();
    const item = items.find(i => i.id === itemId) || null;
    if (item) await this.attachImagesToItems([item]);
    return item;
  }

  private async getItemImages(): Promise<InventoryItemImage[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_ITEM_IMAGES);
    if (!stored) return [];
    return JSON.parse(stored);
  }

  private async saveItemImages(images: InventoryItemImage[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_ITEM_IMAGES, JSON.stringify(images));
  }

  private async attachImagesToItems(items: InventoryItem[]): Promise<void> {
    const allImages = await this.getItemImages();
    for (const item of items) {
      item.images = allImages
        .filter(im => im.itemId === item.id)
        .sort((a, b) => (a.isMain === b.isMain ? a.sortOrder - b.sortOrder : a.isMain ? -1 : 1));
    }
  }
  
  async createItem(item: Omit<InventoryItem, 'id' | 'createdAt'>): Promise<InventoryItem> {
    const items = await this.getItems();
    const newItem: InventoryItem = {
      ...item,
      id: 'item-' + Date.now(),
      createdAt: new Date().toISOString(),
    };
    items.push(newItem);
    await this.saveItems(items);
    
    // Check if stock is at or below minimum level and create notification
    if (newItem.stock <= newItem.lowStockThreshold) {
      const { repos } = await import('../../services/container');
      await repos.notificationsRepo.createNotification({
        type: 'inventory.lowStock',
        payloadJson: {
          itemName: newItem.name,
          itemId: newItem.id,
          stock: newItem.stock,
          threshold: newItem.lowStockThreshold,
        },
        createdBySystem: true,
      });
    }
    
    return newItem;
  }
  
  async updateItem(itemId: string, updates: Partial<InventoryItem>): Promise<InventoryItem> {
    const items = await this.getItems();
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) {
      throw new Error('Item not found');
    }
    const previousStock = items[index].stock;
    const previousThreshold = items[index].lowStockThreshold;
    items[index] = { ...items[index], ...updates };
    await this.saveItems(items);
    
    const updatedItem = items[index];
    // Check if stock reached minimum level and create notification
    if (updatedItem.stock !== undefined && updatedItem.lowStockThreshold !== undefined) {
      const stockChanged = updates.stock !== undefined && updates.stock !== previousStock;
      const thresholdChanged = updates.lowStockThreshold !== undefined && updates.lowStockThreshold !== previousThreshold;
      
      if (updatedItem.stock <= updatedItem.lowStockThreshold) {
        // Only create notification if stock just reached threshold or threshold was lowered
        const shouldNotify = (stockChanged && previousStock > updatedItem.lowStockThreshold) ||
                             (thresholdChanged && updatedItem.stock <= updatedItem.lowStockThreshold && previousStock > previousThreshold);
        
        if (shouldNotify) {
          const { repos } = await import('../../services/container');
          await repos.notificationsRepo.createNotification({
            type: 'inventory.lowStock',
            payloadJson: {
              itemName: updatedItem.name,
              itemId: updatedItem.id,
              stock: updatedItem.stock,
              threshold: updatedItem.lowStockThreshold,
            },
            createdBySystem: true,
          });
        }
      }
    }
    
    return items[index];
  }
  
  async deleteItem(itemId: string): Promise<void> {
    const items = await this.getItems();
    const filteredItems = items.filter(i => i.id !== itemId);
    if (filteredItems.length === items.length) {
      throw new Error('Item not found');
    }
    await this.saveItems(filteredItems);
  }
  
  async adjustStock(itemId: string, delta: number, userId: string): Promise<InventoryItem> {
    const items = await this.getItems();
    const index = items.findIndex(i => i.id === itemId);
    if (index === -1) {
      throw new Error('Item not found');
    }
    
    const item = items[index];
    const previousValue = item.stock;
    const newValue = previousValue + delta;
    
    items[index] = { ...item, stock: newValue };
    await this.saveItems(items);
    
    // Add history entry
    const history = await this.getHistory();
    const historyEntry: InventoryHistory = {
      id: 'hist-' + Date.now(),
      itemId,
      action: 'adjustStock',
      delta,
      previousValue,
      newValue,
      createdBy: userId,
      createdAt: new Date().toISOString(),
    };
    history.push(historyEntry);
    await this.saveHistory(history);
    
    // Check if stock reached minimum level and create notification
    const updatedItem = items[index];
    if (updatedItem.stock <= updatedItem.lowStockThreshold && previousValue > updatedItem.lowStockThreshold) {
      // Stock just reached or went below minimum threshold
      // Use dynamic import to avoid circular dependency
      const { repos } = await import('../../services/container');
      await repos.notificationsRepo.createNotification({
        type: 'inventory.lowStock',
        payloadJson: {
          itemName: updatedItem.name,
          itemId: updatedItem.id,
          stock: updatedItem.stock,
          threshold: updatedItem.lowStockThreshold,
        },
        createdBySystem: true,
      });
    }
    
    return items[index];
  }
  
  async getItemHistory(itemId: string): Promise<InventoryHistory[]> {
    const history = await this.getHistory();
    return history.filter(h => h.itemId === itemId);
  }

  async addItemImage(
    itemId: string,
    file: { uri: string; name: string; type: string },
    isMain = false
  ): Promise<InventoryItemImage> {
    const images = await this.getItemImages();
    const itemImages = images.filter(im => im.itemId === itemId);
    if (itemImages.length >= 3) throw new Error('Maximum of 3 images per item');
    if (isMain) {
      for (const im of images) {
        if (im.itemId === itemId) (im as InventoryItemImage).isMain = false;
      }
      await this.saveItemImages(images);
    }
    const newImage: InventoryItemImage = {
      id: 'img-' + Date.now(),
      itemId,
      storagePath: `inventory-items/${itemId}/${Date.now()}.${file.name.split('.').pop() || 'jpg'}`,
      sortOrder: itemImages.length,
      isMain,
      createdAt: new Date().toISOString(),
    };
    images.push(newImage);
    await this.saveItemImages(images);
    return newImage;
  }

  async deleteItemImage(imageId: string): Promise<void> {
    const images = await this.getItemImages();
    const filtered = images.filter(im => im.id !== imageId);
    if (filtered.length === images.length) throw new Error('Image not found');
    await this.saveItemImages(filtered);
  }

  async setMainItemImage(imageId: string): Promise<void> {
    const images = await this.getItemImages();
    const image = images.find(img => img.id === imageId);
    if (!image) throw new Error('Image not found');
    for (const im of images) {
      (im as InventoryItemImage).isMain = im.itemId === image.itemId && im.id === imageId;
    }
    await this.saveItemImages(images);
  }

  async getItemImageUrlSigned(_storagePath: string): Promise<string> {
    return '';
  }
}
