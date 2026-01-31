import { MaintenanceRepository } from '../../services/repositories/interfaces';
import { MaintenanceRecord, MaintenanceInfo, MaintenanceInfoImage, MaintenanceHistory, MaintenanceHistoryChangeType } from '../../types';
import { supabase } from '../../services/supabase';
import { Platform } from 'react-native';

const BUCKET_NAME = 'documents';

export class SupabaseMaintenanceRepository implements MaintenanceRepository {
  async getAllMaintenanceRecords(): Promise<MaintenanceRecord[]> {
    const { data, error } = await supabase
      .from('maintenance_records')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching maintenance records:', error);
      throw new Error('Failed to fetch maintenance records');
    }

    // Load relations for each record
    const records = await Promise.all(
      (data || []).map(async (record) => await this.loadRecordWithRelations(record))
    );

    return records;
  }

  async getMaintenanceRecordById(recordId: string): Promise<MaintenanceRecord | null> {
    const { data, error } = await supabase
      .from('maintenance_records')
      .select('*')
      .eq('id', recordId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching maintenance record:', error);
      throw new Error('Failed to fetch maintenance record');
    }

    if (!data) return null;

    return await this.loadRecordWithRelations(data);
  }

  async uploadCoverImage(file: { uri: string; name: string; type: string }): Promise<string> {
    return this.uploadImage(file);
  }

  async createMaintenanceRecord(
    record: Omit<MaintenanceRecord, 'id' | 'createdAt' | 'updatedAt' | 'infos' | 'history'>
  ): Promise<MaintenanceRecord> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const insertData: Record<string, unknown> = {
      title: record.title,
      equipment: record.equipment,
      type: record.type,
      created_by: user.id,
    };
    if (record.coverImagePath) {
      insertData.cover_image_path = record.coverImagePath;
    }

    // Create maintenance record
    const { data: recordData, error: recordError } = await supabase
      .from('maintenance_records')
      .insert(insertData)
      .select()
      .single();

    if (recordError) {
      console.error('Error creating maintenance record:', recordError);
      throw new Error('Failed to create maintenance record');
    }

    // Create history entry for creation
    await this.createHistoryEntry(recordData.id, user.id, 'created', 'Record created');

    return await this.loadRecordWithRelations(recordData);
  }

  async updateMaintenanceRecord(
    recordId: string,
    updates: Partial<MaintenanceRecord>,
    changedBy?: string
  ): Promise<MaintenanceRecord> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const updateData: any = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.equipment !== undefined) updateData.equipment = updates.equipment;
    if (updates.type !== undefined) updateData.type = updates.type;
    if (updates.coverImagePath !== undefined) updateData.cover_image_path = updates.coverImagePath || null;

    const { data, error } = await supabase
      .from('maintenance_records')
      .update(updateData)
      .eq('id', recordId)
      .select()
      .single();

    if (error) {
      console.error('Error updating maintenance record:', error);
      throw new Error('Failed to update maintenance record');
    }

    // Create history entry
    await this.createHistoryEntry(recordId, changedBy || user.id, 'updated', 'Record updated');

    return await this.loadRecordWithRelations(data);
  }

  async deleteMaintenanceRecord(recordId: string): Promise<void> {
    const { error } = await supabase
      .from('maintenance_records')
      .delete()
      .eq('id', recordId);

    if (error) {
      console.error('Error deleting maintenance record:', error);
      throw new Error('Failed to delete maintenance record');
    }
  }

  async addMaintenanceInfo(
    recordId: string,
    info: Omit<MaintenanceInfo, 'id' | 'createdAt' | 'updatedAt' | 'images'>
  ): Promise<MaintenanceInfo> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get current max order_index for this record
    const { data: existingInfos } = await supabase
      .from('maintenance_infos')
      .select('order_index')
      .eq('maintenance_record_id', recordId)
      .order('order_index', { ascending: false })
      .limit(1);

    const nextOrderIndex = existingInfos && existingInfos.length > 0 
      ? (existingInfos[0].order_index || 0) + 1 
      : 0;

    // Create maintenance info
    const { data: infoData, error: infoError } = await supabase
      .from('maintenance_infos')
      .insert({
        maintenance_record_id: recordId,
        description: info.description,
        order_index: nextOrderIndex,
      })
      .select()
      .single();

    if (infoError) {
      console.error('Error creating maintenance info:', infoError);
      throw new Error('Failed to create maintenance info');
    }

    // Create history entry
    await this.createHistoryEntry(recordId, user.id, 'info_added', `Info box ${nextOrderIndex + 1} added`);

    return {
      id: infoData.id,
      maintenanceRecordId: infoData.maintenance_record_id,
      description: infoData.description,
      orderIndex: infoData.order_index,
      images: [],
      createdAt: infoData.created_at,
      updatedAt: infoData.updated_at,
    };
  }

  async updateMaintenanceInfo(
    infoId: string,
    updates: Partial<MaintenanceInfo>,
    changedBy?: string
  ): Promise<MaintenanceInfo> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const updateData: any = {};
    if (updates.description !== undefined) updateData.description = updates.description;

    const { data: infoData, error: infoError } = await supabase
      .from('maintenance_infos')
      .select('*, maintenance_records!inner(id)')
      .eq('id', infoId)
      .single();

    if (infoError || !infoData) {
      throw new Error('Maintenance info not found');
    }

    const recordId = (infoData.maintenance_records as any).id;

    const { data: updatedInfo, error: updateError } = await supabase
      .from('maintenance_infos')
      .update(updateData)
      .eq('id', infoId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating maintenance info:', updateError);
      throw new Error('Failed to update maintenance info');
    }

    // Create history entry
    await this.createHistoryEntry(recordId, changedBy || user.id, 'info_updated', `Info box updated`);

    // Load with images
    const { data: imagesData } = await supabase
      .from('maintenance_info_images')
      .select('*')
      .eq('maintenance_info_id', infoId)
      .order('order_index', { ascending: true });

    const images: MaintenanceInfoImage[] = (imagesData || []).map((img: any) => ({
      id: img.id,
      maintenanceInfoId: img.maintenance_info_id,
      storagePath: img.storage_path,
      filename: img.filename,
      mimeType: img.mime_type,
      orderIndex: img.order_index,
      createdAt: img.created_at,
    }));

    return {
      id: updatedInfo.id,
      maintenanceRecordId: updatedInfo.maintenance_record_id,
      description: updatedInfo.description,
      orderIndex: updatedInfo.order_index,
      images,
      createdAt: updatedInfo.created_at,
      updatedAt: updatedInfo.updated_at,
    };
  }

  async deleteMaintenanceInfo(infoId: string, changedBy?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get record ID before deleting
    const { data: infoData } = await supabase
      .from('maintenance_infos')
      .select('maintenance_record_id')
      .eq('id', infoId)
      .single();

    const recordId = infoData?.maintenance_record_id;

    const { error } = await supabase
      .from('maintenance_infos')
      .delete()
      .eq('id', infoId);

    if (error) {
      console.error('Error deleting maintenance info:', error);
      throw new Error('Failed to delete maintenance info');
    }

    // Create history entry
    if (recordId) {
      await this.createHistoryEntry(recordId, changedBy || user.id, 'info_deleted', 'Info box deleted');
    }
  }

  async addMaintenanceInfoImage(
    infoId: string,
    image: Omit<MaintenanceInfoImage, 'id' | 'createdAt'>
  ): Promise<MaintenanceInfoImage> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get record ID for history
    const { data: infoData } = await supabase
      .from('maintenance_infos')
      .select('maintenance_record_id')
      .eq('id', infoId)
      .single();

    if (!infoData) {
      throw new Error('Maintenance info not found');
    }

    // Upload image to storage if it's a local file
    let storagePath = image.storagePath;
    if (storagePath.startsWith('file://') || storagePath.startsWith('content://')) {
      try {
        const filename = await this.uploadImage({
          uri: storagePath,
          name: image.filename,
          type: image.mimeType,
        });
        storagePath = filename;
      } catch (uploadError) {
        console.error('Error uploading image:', uploadError);
        throw new Error('Failed to upload image');
      }
    }

    // Get current max order_index for this info
    const { data: existingImages } = await supabase
      .from('maintenance_info_images')
      .select('order_index')
      .eq('maintenance_info_id', infoId)
      .order('order_index', { ascending: false })
      .limit(1);

    const nextOrderIndex = existingImages && existingImages.length > 0 
      ? (existingImages[0].order_index || 0) + 1 
      : 0;

    // Create image record
    const { data: imageData, error: imageError } = await supabase
      .from('maintenance_info_images')
      .insert({
        maintenance_info_id: infoId,
        storage_path: storagePath,
        filename: image.filename,
        mime_type: image.mimeType,
        order_index: nextOrderIndex,
      })
      .select()
      .single();

    if (imageError) {
      console.error('Error creating maintenance info image:', imageError);
      throw new Error('Failed to create maintenance info image');
    }

    // Create history entry
    await this.createHistoryEntry(infoData.maintenance_record_id, user.id, 'image_added', `Image added to info box`);

    return {
      id: imageData.id,
      maintenanceInfoId: imageData.maintenance_info_id,
      storagePath: imageData.storage_path,
      filename: imageData.filename,
      mimeType: imageData.mime_type,
      orderIndex: imageData.order_index,
      createdAt: imageData.created_at,
    };
  }

  async deleteMaintenanceInfoImage(imageId: string, changedBy?: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Get record ID for history before deleting
    const { data: imageData } = await supabase
      .from('maintenance_info_images')
      .select('maintenance_info_id, maintenance_infos!inner(maintenance_record_id)')
      .eq('id', imageId)
      .single();

    const recordId = imageData ? (imageData.maintenance_infos as any).maintenance_record_id : null;

    const { error } = await supabase
      .from('maintenance_info_images')
      .delete()
      .eq('id', imageId);

    if (error) {
      console.error('Error deleting maintenance info image:', error);
      throw new Error('Failed to delete maintenance info image');
    }

    // Create history entry
    if (recordId) {
      await this.createHistoryEntry(recordId, changedBy || user.id, 'image_deleted', 'Image deleted from info box');
    }
  }

  async getMaintenanceHistory(recordId: string): Promise<MaintenanceHistory[]> {
    const { data, error } = await supabase
      .from('maintenance_history')
      .select('*')
      .eq('maintenance_record_id', recordId)
      .order('changed_at', { ascending: false });

    if (error) {
      console.error('Error fetching maintenance history:', error);
      throw new Error('Failed to fetch maintenance history');
    }

    return (data || []).map(this.mapToHistory);
  }

  private async loadRecordWithRelations(recordData: any): Promise<MaintenanceRecord> {
    const recordId = recordData.id;

    // Load infos
    const { data: infosData } = await supabase
      .from('maintenance_infos')
      .select('*')
      .eq('maintenance_record_id', recordId)
      .order('order_index', { ascending: true });

    const infos: MaintenanceInfo[] = await Promise.all(
      (infosData || []).map(async (info: any) => {
        // Load images for this info
        const { data: imagesData } = await supabase
          .from('maintenance_info_images')
          .select('*')
          .eq('maintenance_info_id', info.id)
          .order('order_index', { ascending: true });

        const images: MaintenanceInfoImage[] = await Promise.all(
          (imagesData || []).map(async (img: any) => {
            // Get signed URL for image
            const url = await this.getImageUrl(img.storage_path);
            return {
              id: img.id,
              maintenanceInfoId: img.maintenance_info_id,
              storagePath: url,
              filename: img.filename,
              mimeType: img.mime_type,
              orderIndex: img.order_index,
              createdAt: img.created_at,
            };
          })
        );

        return {
          id: info.id,
          maintenanceRecordId: info.maintenance_record_id,
          description: info.description,
          orderIndex: info.order_index,
          images,
          createdAt: info.created_at,
          updatedAt: info.updated_at,
        };
      })
    );

    // Load history
    const history = await this.getMaintenanceHistory(recordId);

    // Resolve cover image to signed URL if present
    let coverImagePath: string | undefined;
    if (recordData.cover_image_path) {
      try {
        coverImagePath = await this.getImageUrl(recordData.cover_image_path);
      } catch {
        coverImagePath = undefined;
      }
    }

    return {
      id: recordData.id,
      title: recordData.title,
      equipment: recordData.equipment,
      type: recordData.type,
      coverImagePath,
      infos,
      history,
      createdAt: recordData.created_at,
      updatedAt: recordData.updated_at,
      createdBy: recordData.created_by,
    };
  }

  private async uploadImage(file: { uri: string; name: string; type: string }): Promise<string> {
    const filename = file.name;
    const fileUri = file.uri;
    const mimeType = file.type;

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFilename = `maintenance_${timestamp}_${filename}`;

    try {
      let fileData: Blob | Uint8Array | string;

      if (Platform.OS === 'web' && typeof fetch !== 'undefined') {
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
      } else if (typeof window !== 'undefined' && file instanceof File) {
        // Web - use File directly
        fileData = file;
      } else if (typeof fetch !== 'undefined') {
        // Try to fetch the file as blob
        const response = await fetch(fileUri);
        fileData = await response.blob();
      } else {
        throw new Error('Unsupported file type or environment');
      }

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(uniqueFilename, fileData, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading image to storage:', uploadError);
        throw new Error(`Failed to upload image to storage: ${uploadError.message}`);
      }

      return uniqueFilename; // Return just the filename, not full path
    } catch (error: any) {
      console.error('Error uploading image:', error);
      throw new Error(error?.message || 'Failed to upload image');
    }
  }

  private async getImageUrl(storagePath: string): Promise<string> {
    // If already a URL (http/https), return as is
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      return storagePath;
    }

    // Skip if it's a local file URI (file:// or content://)
    if (storagePath.startsWith('file://') || storagePath.startsWith('content://')) {
      return storagePath;
    }

    // Extract filename from storage path
    let filename = storagePath;
    
    // Remove bucket name prefix if present
    if (storagePath.startsWith(`${BUCKET_NAME}/`)) {
      filename = storagePath.replace(`${BUCKET_NAME}/`, '');
    } else if (storagePath.includes('/')) {
      const parts = storagePath.split('/');
      filename = parts[parts.length - 1];
    }

    filename = filename.trim().replace(/^\/+|\/+$/g, '');

    if (!filename) {
      return storagePath;
    }

    try {
      // Get signed URL from Supabase Storage (valid for 1 hour)
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filename, 3600);

      if (error) {
        // Silently handle "not found" errors - these are expected for missing files
        const isNotFoundError = 
          error.message?.includes('not found') || 
          error.message?.includes('Object not found') ||
          error.message?.includes('The resource was not found');
        
        if (!isNotFoundError) {
          console.warn('Error getting image URL:', error.message);
        }
        return storagePath;
      }

      return data.signedUrl;
    } catch (error: any) {
      // Silently handle "not found" errors
      const isNotFoundError = 
        error?.message?.includes('not found') || 
        error?.message?.includes('Object not found') ||
        error?.message?.includes('The resource was not found');
      
      if (!isNotFoundError) {
        console.warn('Exception getting image URL:', error?.message);
      }
      return storagePath;
    }
  }

  private async createHistoryEntry(
    recordId: string,
    changedBy: string,
    changeType: MaintenanceHistoryChangeType,
    changeDescription?: string
  ): Promise<void> {
    await supabase
      .from('maintenance_history')
      .insert({
        maintenance_record_id: recordId,
        changed_by: changedBy,
        change_type: changeType,
        change_description: changeDescription,
      });
  }

  private mapToHistory(data: any): MaintenanceHistory {
    return {
      id: data.id,
      maintenanceRecordId: data.maintenance_record_id,
      changedBy: data.changed_by,
      changeType: data.change_type as MaintenanceHistoryChangeType,
      changeDescription: data.change_description,
      changedAt: data.changed_at,
    };
  }
}
