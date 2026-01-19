import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaintenanceRepository } from '../../services/repositories/interfaces';
import { MaintenanceRecord, MaintenanceInfo, MaintenanceInfoImage, MaintenanceHistory, MaintenanceHistoryChangeType } from '../../types';

const STORAGE_KEY_RECORDS = 'mock_maintenance_records';
const STORAGE_KEY_INFOS = 'mock_maintenance_infos';
const STORAGE_KEY_IMAGES = 'mock_maintenance_info_images';
const STORAGE_KEY_HISTORY = 'mock_maintenance_history';

export class MockMaintenanceRepository implements MaintenanceRepository {
  private async getRecords(): Promise<MaintenanceRecord[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_RECORDS);
    if (!stored) return [];
    return JSON.parse(stored);
  }

  private async saveRecords(records: MaintenanceRecord[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_RECORDS, JSON.stringify(records));
  }

  private async getInfos(): Promise<MaintenanceInfo[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_INFOS);
    if (!stored) return [];
    return JSON.parse(stored);
  }

  private async saveInfos(infos: MaintenanceInfo[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_INFOS, JSON.stringify(infos));
  }

  private async getImages(): Promise<MaintenanceInfoImage[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_IMAGES);
    if (!stored) return [];
    return JSON.parse(stored);
  }

  private async saveImages(images: MaintenanceInfoImage[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_IMAGES, JSON.stringify(images));
  }

  private async getHistory(): Promise<MaintenanceHistory[]> {
    const stored = await AsyncStorage.getItem(STORAGE_KEY_HISTORY);
    if (!stored) return [];
    return JSON.parse(stored);
  }

  private async saveHistory(history: MaintenanceHistory[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
  }

  async getAllMaintenanceRecords(): Promise<MaintenanceRecord[]> {
    const records = await this.getRecords();
    const infos = await this.getInfos();
    const images = await this.getImages();
    const history = await this.getHistory();

    return records.map(record => ({
      ...record,
      infos: infos
        .filter(info => info.maintenanceRecordId === record.id)
        .map(info => ({
          ...info,
          images: images.filter(img => img.maintenanceInfoId === info.id),
        }))
        .sort((a, b) => a.orderIndex - b.orderIndex),
      history: history
        .filter(h => h.maintenanceRecordId === record.id)
        .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()),
    }));
  }

  async getMaintenanceRecordById(recordId: string): Promise<MaintenanceRecord | null> {
    const records = await this.getAllMaintenanceRecords();
    return records.find(r => r.id === recordId) || null;
  }

  async createMaintenanceRecord(
    record: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'infos' | 'history'>
  ): Promise<MaintenanceRecord> {
    const records = await this.getRecords();
    const newRecord: MaintenanceRecord = {
      ...record,
      id: 'maintenance-' + Date.now(),
      infos: [],
      history: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    records.push(newRecord);
    await this.saveRecords(records);

    // Create history entry
    const history = await this.getHistory();
    history.push({
      id: 'hist-' + Date.now(),
      maintenanceRecordId: newRecord.id,
      changedBy: record.createdBy,
      changeType: 'created',
      changeDescription: 'Record created',
      changedAt: new Date().toISOString(),
    });
    await this.saveHistory(history);

    return newRecord;
  }

  async updateMaintenanceRecord(
    recordId: string,
    updates: Partial<MaintenanceRecord>,
    changedBy?: string
  ): Promise<MaintenanceRecord> {
    const records = await this.getRecords();
    const index = records.findIndex(r => r.id === recordId);
    if (index === -1) {
      throw new Error('Maintenance record not found');
    }

    records[index] = {
      ...records[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.saveRecords(records);

    // Create history entry
    if (changedBy) {
      const history = await this.getHistory();
      history.push({
        id: 'hist-' + Date.now(),
        maintenanceRecordId: recordId,
        changedBy,
        changeType: 'updated',
        changeDescription: 'Record updated',
        changedAt: new Date().toISOString(),
      });
      await this.saveHistory(history);
    }

    return await this.getMaintenanceRecordById(recordId)!;
  }

  async deleteMaintenanceRecord(recordId: string): Promise<void> {
    const records = await this.getRecords();
    const filtered = records.filter(r => r.id !== recordId);
    await this.saveRecords(filtered);

    // Delete related infos and images
    const infos = await this.getInfos();
    const infoIds = infos.filter(i => i.maintenanceRecordId === recordId).map(i => i.id);
    await this.saveInfos(infos.filter(i => i.maintenanceRecordId !== recordId));

    const images = await this.getImages();
    await this.saveImages(images.filter(img => !infoIds.includes(img.maintenanceInfoId)));

    const history = await this.getHistory();
    await this.saveHistory(history.filter(h => h.maintenanceRecordId !== recordId));
  }

  async addMaintenanceInfo(
    recordId: string,
    info: Omit<MaintenanceInfo, 'id' | 'createdAt' | 'updatedAt' | 'images'>
  ): Promise<MaintenanceInfo> {
    const infos = await this.getInfos();
    const recordInfos = infos.filter(i => i.maintenanceRecordId === recordId);
    const nextOrderIndex = recordInfos.length;

    // Get record to get createdBy
    const records = await this.getRecords();
    const record = records.find(r => r.id === recordId);
    const changedBy = record?.createdBy || 'system';

    const newInfo: MaintenanceInfo = {
      ...info,
      id: 'info-' + Date.now(),
      maintenanceRecordId: recordId,
      orderIndex: nextOrderIndex,
      images: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    infos.push(newInfo);
    await this.saveInfos(infos);

    // Create history entry
    const history = await this.getHistory();
    history.push({
      id: 'hist-' + Date.now(),
      maintenanceRecordId: recordId,
      changedBy,
      changeType: 'info_added',
      changeDescription: `Info box ${nextOrderIndex + 1} added`,
      changedAt: new Date().toISOString(),
    });
    await this.saveHistory(history);

    return newInfo;
  }

  async updateMaintenanceInfo(
    infoId: string,
    updates: Partial<MaintenanceInfo>,
    changedBy?: string
  ): Promise<MaintenanceInfo> {
    const infos = await this.getInfos();
    const index = infos.findIndex(i => i.id === infoId);
    if (index === -1) {
      throw new Error('Maintenance info not found');
    }

    infos[index] = {
      ...infos[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };
    await this.saveInfos(infos);

    // Create history entry
    if (changedBy) {
      const history = await this.getHistory();
      history.push({
        id: 'hist-' + Date.now(),
        maintenanceRecordId: infos[index].maintenanceRecordId,
        changedBy,
        changeType: 'info_updated',
        changeDescription: 'Info box updated',
        changedAt: new Date().toISOString(),
      });
      await this.saveHistory(history);
    }

    const images = await this.getImages();
    return {
      ...infos[index],
      images: images.filter(img => img.maintenanceInfoId === infoId),
    };
  }

  async deleteMaintenanceInfo(infoId: string, changedBy?: string): Promise<void> {
    const infos = await this.getInfos();
    const info = infos.find(i => i.id === infoId);
    if (!info) {
      throw new Error('Maintenance info not found');
    }

    await this.saveInfos(infos.filter(i => i.id !== infoId));

    // Delete related images
    const images = await this.getImages();
    await this.saveImages(images.filter(img => img.maintenanceInfoId !== infoId));

    // Create history entry
    if (changedBy) {
      const history = await this.getHistory();
      history.push({
        id: 'hist-' + Date.now(),
        maintenanceRecordId: info.maintenanceRecordId,
        changedBy,
        changeType: 'info_deleted',
        changeDescription: 'Info box deleted',
        changedAt: new Date().toISOString(),
      });
      await this.saveHistory(history);
    }
  }

  async addMaintenanceInfoImage(
    infoId: string,
    image: Omit<MaintenanceInfoImage, 'id' | 'createdAt'>
  ): Promise<MaintenanceInfoImage> {
    const images = await this.getImages();
    const infoImages = images.filter(img => img.maintenanceInfoId === infoId);
    
    if (infoImages.length >= 3) {
      throw new Error('Maximum of 3 images allowed per maintenance info');
    }

    const nextOrderIndex = infoImages.length;

    const newImage: MaintenanceInfoImage = {
      ...image,
      id: 'img-' + Date.now(),
      maintenanceInfoId: infoId,
      orderIndex: nextOrderIndex,
      createdAt: new Date().toISOString(),
    };
    images.push(newImage);
    await this.saveImages(images);

    // Create history entry
    const infos = await this.getInfos();
    const info = infos.find(i => i.id === infoId);
    if (info) {
      const records = await this.getRecords();
      const record = records.find(r => r.id === info.maintenanceRecordId);
      const changedBy = record?.createdBy || 'system';

      const history = await this.getHistory();
      history.push({
        id: 'hist-' + Date.now(),
        maintenanceRecordId: info.maintenanceRecordId,
        changedBy,
        changeType: 'image_added',
        changeDescription: 'Image added to info box',
        changedAt: new Date().toISOString(),
      });
      await this.saveHistory(history);
    }

    return newImage;
  }

  async deleteMaintenanceInfoImage(imageId: string, changedBy?: string): Promise<void> {
    const images = await this.getImages();
    const image = images.find(img => img.id === imageId);
    if (!image) {
      throw new Error('Maintenance info image not found');
    }

    await this.saveImages(images.filter(img => img.id !== imageId));

    // Create history entry
    if (changedBy) {
      const infos = await this.getInfos();
      const info = infos.find(i => i.id === image.maintenanceInfoId);
      if (info) {
        const history = await this.getHistory();
        history.push({
          id: 'hist-' + Date.now(),
          maintenanceRecordId: info.maintenanceRecordId,
          changedBy,
          changeType: 'image_deleted',
          changeDescription: 'Image deleted from info box',
          changedAt: new Date().toISOString(),
        });
        await this.saveHistory(history);
      }
    }
  }

  async getMaintenanceHistory(recordId: string): Promise<MaintenanceHistory[]> {
    const history = await this.getHistory();
    return history
      .filter(h => h.maintenanceRecordId === recordId)
      .sort((a, b) => new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime());
  }
}
