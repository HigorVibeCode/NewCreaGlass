import AsyncStorage from '@react-native-async-storage/async-storage';

// A stock count done in several places (e.g. upstairs + downstairs).
// Partial counts stay on this device until the count is confirmed.
export interface PartialCount {
  id: string;
  quantity: number;
  location: string;
  createdAt: string;
}

const keyFor = (itemId: string) => `pending_stock_count_${itemId}`;

export const getPendingCount = async (itemId: string): Promise<PartialCount[]> => {
  try {
    const raw = await AsyncStorage.getItem(keyFor(itemId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn('Error reading pending stock count:', error);
    return [];
  }
};

export const savePendingCount = async (itemId: string, entries: PartialCount[]): Promise<void> => {
  if (entries.length === 0) {
    await AsyncStorage.removeItem(keyFor(itemId));
    return;
  }
  await AsyncStorage.setItem(keyFor(itemId), JSON.stringify(entries));
};

export const clearPendingCount = (itemId: string): Promise<void> => AsyncStorage.removeItem(keyFor(itemId));

export const sumPartialCounts = (entries: PartialCount[]): number =>
  entries.reduce((sum, entry) => sum + entry.quantity, 0);
