import { Platform } from 'react-native';
import { ProductionRepository } from '../../services/repositories/interfaces';
import { Production, ProductionItem, ProductionAttachment, ProductionStatus, ProductionStatusHistory } from '../../types';
import { supabase } from '../../services/supabase';
import { extractStorageObjectKey, getSignedUrlFromStorage } from '../../utils/attachments';
import {
  buildProductionStorageKey,
  getOriginalNameFromStorageKey,
  isDxfFile,
} from '../../utils/production-attachment-storage';

const BUCKET_NAME = 'documents';

/** Returns true when the value is a local/temporary URI that still needs uploading to Storage */
function needsUpload(uri: string): boolean {
  return (
    uri.startsWith('file://') ||
    uri.startsWith('content://') ||
    uri.startsWith('blob:') ||
    uri.startsWith('data:')
  );
}

export class SupabaseProductionRepository implements ProductionRepository {
  async getAllProductions(status?: ProductionStatus): Promise<Production[]> {
    let query = supabase
      .from('productions')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching productions:', error);
      throw new Error('Failed to fetch productions');
    }

    const rows = data || [];
    if (rows.length === 0) return [];

    const ids = rows.map((r: any) => r.id);

    const [{ data: allItems }, { data: allAttachments }] = await Promise.all([
      supabase.from('production_items').select('*').in('production_id', ids),
      supabase.from('production_attachments').select('*').in('production_id', ids),
    ]);

    const itemsByProd = new Map<string, ProductionItem[]>();
    for (const item of allItems || []) {
      const pid = item.production_id;
      if (!itemsByProd.has(pid)) itemsByProd.set(pid, []);
      itemsByProd.get(pid)!.push({
        id: item.id,
        glassId: item.glass_id,
        glassType: item.glass_type,
        quantity: item.quantity,
        areaM2: item.area_m2,
        structureType: item.structure_type,
        paintType: item.paint_type,
      });
    }

    const attsByProd = new Map<string, ProductionAttachment[]>();
    for (const att of allAttachments || []) {
      const pid = att.production_id;
      if (!attsByProd.has(pid)) attsByProd.set(pid, []);
      const displayName =
        att.original_name ||
        getOriginalNameFromStorageKey(att.storage_path) ||
        att.filename;
      attsByProd.get(pid)!.push({
        id: att.id,
        filename: displayName,
        originalName: displayName,
        mimeType: att.mime_type,
        storagePath: att.storage_path,
        originalStoragePath: att.storage_path,
        createdAt: att.created_at,
      });
    }

    return rows.map((prod: any) => ({
      id: prod.id,
      clientId: prod.client_id || undefined,
      clientName: prod.client_name,
      orderNumber: prod.order_number,
      orderType: prod.order_type,
      dueDate: prod.due_date,
      status: prod.status as ProductionStatus,
      items: itemsByProd.get(prod.id) || [],
      attachments: attsByProd.get(prod.id) || [],
      linkedWorkOrderId: prod.linked_work_order_id || undefined,
      company: prod.company ?? undefined,
      createdAt: prod.created_at,
      createdBy: prod.created_by,
    }));
  }

  async getProductionById(productionId: string): Promise<Production | null> {
    const { data, error } = await supabase
      .from('productions')
      .select('*')
      .eq('id', productionId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching production:', error);
      throw new Error('Failed to fetch production');
    }

    if (!data) return null;

    return await this.loadProductionWithRelations(data);
  }

  async createProduction(production: Omit<Production, 'id' | 'createdAt'>): Promise<Production> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    // Create production record
    const { data: prodData, error: prodError } = await supabase
      .from('productions')
      .insert({
        client_id: production.clientId ?? null,
        client_name: production.clientName,
        order_number: production.orderNumber,
        order_type: production.orderType,
        due_date: production.dueDate,
        status: production.status,
        created_by: user.id,
        ...(production.company != null && production.company !== '' && { company: production.company }),
      })
      .select()
      .single();

    if (prodError) {
      console.error('Error creating production:', prodError);
      throw new Error('Failed to create production');
    }

    const productionId = prodData.id;

    // Create production items
    if (production.items && production.items.length > 0) {
      const itemsToInsert = production.items.map(item => ({
        production_id: productionId,
        glass_id: item.glassId,
        glass_type: item.glassType,
        quantity: item.quantity,
        area_m2: item.areaM2,
        structure_type: item.structureType,
        paint_type: item.paintType,
      }));

      const { error: itemsError } = await supabase
        .from('production_items')
        .insert(itemsToInsert);

      if (itemsError) {
        console.error('Error creating production items:', itemsError);
        // Clean up production if items fail
        await supabase.from('productions').delete().eq('id', productionId);
        throw new Error('Failed to create production items');
      }
    }

    if (production.attachments && production.attachments.length > 0) {
      const uploadFailures: string[] = [];
      for (const attachment of production.attachments) {
        let storagePath = attachment.storagePath;

        if (needsUpload(storagePath)) {
          try {
            storagePath = await this.uploadAttachment({
              uri: storagePath,
              name: attachment.originalName || attachment.filename,
              type: attachment.mimeType,
              webFile: attachment.webFile,
            });
          } catch (uploadError) {
            console.error('Error uploading attachment:', uploadError);
            uploadFailures.push(attachment.originalName || attachment.filename);
            continue;
          }
        }

        await this.insertProductionAttachmentRow(productionId, attachment, storagePath);
      }
      if (uploadFailures.length > 0) {
        throw new Error(`Failed to upload attachment(s): ${uploadFailures.join(', ')}`);
      }
    }

    // Create initial status history
    await supabase
      .from('production_status_history')
      .insert({
        production_id: productionId,
        previous_status: 'not_authorized',
        new_status: production.status,
        changed_by: user.id,
      });

    return await this.loadProductionWithRelations(prodData);
  }

  async updateProduction(
    productionId: string,
    updates: Partial<Production>,
    changedBy?: string
  ): Promise<Production> {
    const updateData: any = {};

    if (updates.clientName !== undefined) updateData.client_name = updates.clientName;
    if (updates.clientId !== undefined) updateData.client_id = updates.clientId;
    if (updates.orderNumber !== undefined) updateData.order_number = updates.orderNumber;
    if (updates.orderType !== undefined) updateData.order_type = updates.orderType;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.company !== undefined) updateData.company = updates.company;
    if (updates.linkedWorkOrderId !== undefined) updateData.linked_work_order_id = updates.linkedWorkOrderId;

    // Get current production to check status change
    const currentProduction = await this.getProductionById(productionId);
    if (!currentProduction) {
      throw new Error('Production not found');
    }

    const previousStatus = currentProduction.status;

    let data: any;
    if (Object.keys(updateData).length > 0) {
      const { data: updatedData, error } = await supabase
        .from('productions')
        .update(updateData)
        .eq('id', productionId)
        .select()
        .single();

      if (error) {
        console.error('Error updating production:', error);
        throw new Error('Failed to update production');
      }
      data = updatedData;
    } else {
      // When only related entities (e.g. attachments) are being updated,
      // skip base table update and reuse current row data.
      const { data: currentData, error } = await supabase
        .from('productions')
        .select('*')
        .eq('id', productionId)
        .single();

      if (error || !currentData) {
        console.error('Error loading production for related update:', error);
        throw new Error('Failed to update production');
      }
      data = currentData;
    }

    // Update items if provided
    if (updates.items !== undefined) {
      // Delete existing items
      await supabase
        .from('production_items')
        .delete()
        .eq('production_id', productionId);

      // Insert new items
      if (updates.items.length > 0) {
        const itemsToInsert = updates.items.map(item => ({
          production_id: productionId,
          glass_id: item.glassId,
          glass_type: item.glassType,
          quantity: item.quantity,
          area_m2: item.areaM2,
          structure_type: item.structureType,
          paint_type: item.paintType,
        }));

        await supabase
          .from('production_items')
          .insert(itemsToInsert);
      }
    }

    // Handle attachments updates if provided
    if (updates.attachments !== undefined) {
      await supabase
        .from('production_attachments')
        .delete()
        .eq('production_id', productionId);

      const uploadFailures: string[] = [];
      for (const attachment of updates.attachments) {
        let storagePath: string;

        if (needsUpload(attachment.storagePath)) {
          try {
            storagePath = await this.uploadAttachment({
              uri: attachment.storagePath,
              name: attachment.originalName || attachment.filename,
              type: attachment.mimeType,
              webFile: attachment.webFile,
            });
          } catch (uploadError) {
            console.error('Error uploading attachment:', uploadError);
            uploadFailures.push(attachment.originalName || attachment.filename);
            continue;
          }
        } else {
          // Prefer the raw DB key; fall back to storagePath only for brand-new entries
          storagePath = attachment.originalStoragePath || attachment.storagePath;

          // Guard: never persist a signed URL or expired https link as the storage key
          if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
            storagePath =
              extractStorageObjectKey(storagePath) ||
              attachment.originalStoragePath ||
              attachment.filename;
          }
        }

        await this.insertProductionAttachmentRow(productionId, attachment, storagePath);
      }
      if (uploadFailures.length > 0) {
        throw new Error(`Failed to upload attachment(s): ${uploadFailures.join(', ')}`);
      }
    }

    // Load complete production data (will be used for return and notifications)
    const updatedProduction = await this.loadProductionWithRelations(data);

    // Create status history entry if status changed
    if (updates.status && updates.status !== previousStatus && changedBy) {
      await supabase
        .from('production_status_history')
        .insert({
          production_id: productionId,
          previous_status: previousStatus,
          new_status: updates.status,
          changed_by: changedBy,
        });

      // Create notification when status changes to 'authorized'
      if (updates.status === 'authorized' && previousStatus !== 'authorized') {
        try {
          const { repos } = await import('../../services/container');
          await repos.notificationsRepo.createNotification({
            type: 'production.authorized',
            payloadJson: {
              clientName: updatedProduction.clientName || '',
              orderType: updatedProduction.orderType || '',
              orderNumber: updatedProduction.orderNumber || '',
              productionId: productionId,
            },
            createdBySystem: true,
          });
        } catch (notifError) {
          console.error('Error creating authorized notification:', notifError);
          // Don't throw - notification is secondary, status update was successful
        }
      }

      // Create notification when status changes to 'tempered'
      if (updates.status === 'tempered' && previousStatus !== 'tempered') {
        try {
          const { repos } = await import('../../services/container');
          
          const notificationPayload = {
            clientName: updatedProduction.clientName || '',
            orderType: updatedProduction.orderType || '',
            orderNumber: updatedProduction.orderNumber || '',
            productionId: productionId,
          };
          
          console.log('[SupabaseProductionRepository] Creating tempered notification with payload:', notificationPayload);
          
          await repos.notificationsRepo.createNotification({
            type: 'production.tempered',
            payloadJson: notificationPayload,
            createdBySystem: true,
          });
          console.log('[SupabaseProductionRepository] Notification created for tempered status');
        } catch (notifError) {
          console.error('Error creating tempered notification:', notifError);
          // Don't throw - notification is secondary, status update was successful
        }
      }
    }

    return updatedProduction;
  }

  async deleteProduction(productionId: string): Promise<void> {
    // Delete related records first (cascade should handle this, but being explicit)
    await supabase.from('production_items').delete().eq('production_id', productionId);
    await supabase.from('production_attachments').delete().eq('production_id', productionId);
    await supabase.from('production_status_history').delete().eq('production_id', productionId);

    // Delete production
    const { error } = await supabase
      .from('productions')
      .delete()
      .eq('id', productionId);

    if (error) {
      console.error('Error deleting production:', error);
      throw new Error('Failed to delete production');
    }
  }

  async getStatusHistory(productionId: string): Promise<ProductionStatusHistory[]> {
    const { data, error } = await supabase
      .from('production_status_history')
      .select('*')
      .eq('production_id', productionId)
      .order('changed_at', { ascending: false });

    if (error) {
      console.error('Error fetching status history:', error);
      throw new Error('Failed to fetch status history');
    }

    return (data || []).map(this.mapToStatusHistory);
  }

  private buildAttachmentInsertRow(
    productionId: string,
    attachment: ProductionAttachment,
    storagePath: string
  ) {
    const displayName = attachment.originalName || attachment.filename;
    return {
      production_id: productionId,
      filename: displayName,
      original_name: displayName,
      mime_type: attachment.mimeType,
      storage_path: storagePath,
    };
  }

  private async insertProductionAttachmentRow(
    productionId: string,
    attachment: ProductionAttachment,
    storagePath: string
  ): Promise<void> {
    const row = this.buildAttachmentInsertRow(productionId, attachment, storagePath);
    const { error } = await supabase.from('production_attachments').insert(row);

    if (error?.message?.includes('original_name')) {
      const { original_name: _removed, ...rowWithoutOriginalName } = row;
      const { error: retryError } = await supabase
        .from('production_attachments')
        .insert(rowWithoutOriginalName);
      if (retryError) {
        console.error('Error inserting production attachment (retry):', retryError);
        throw new Error(`Failed to save attachment: ${retryError.message}`);
      }
      return;
    }

    if (error) {
      console.error('Error inserting production attachment:', error);
      throw new Error(`Failed to save attachment: ${error.message}`);
    }
  }

  async uploadAttachment(file: { uri: string; name: string; type: string; webFile?: File }): Promise<string> {
    const filename = file.name;
    const fileUri = file.uri;
    const mimeType = file.type;

    const uniqueFilename = isDxfFile(filename, mimeType)
      ? buildProductionStorageKey(filename)
      : `${Date.now()}_${filename}`;

    try {
      let fileData: Blob | Uint8Array | string;

      if (Platform.OS === 'web' && file.webFile instanceof File) {
        // Prefer browser File handle on web to avoid stale blob/data URIs.
        fileData = file.webFile;
      } else if (Platform.OS === 'web' && typeof fetch !== 'undefined') {
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

      const contentTypes = isDxfFile(filename, mimeType)
        ? [
            mimeType || 'application/dxf',
            'application/x-dxf',
            'application/octet-stream',
          ]
        : [mimeType];

      let lastUploadError: { message: string } | null = null;
      for (const contentType of contentTypes) {
        const { error: uploadError } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(uniqueFilename, fileData, {
            contentType,
            upsert: false,
          });

        if (!uploadError) {
          return uniqueFilename;
        }

        lastUploadError = uploadError;
        const mimeRejected =
          uploadError.message?.toLowerCase().includes('mime') ||
          uploadError.message?.toLowerCase().includes('not allowed');
        if (!mimeRejected) break;
      }

      if (lastUploadError) {
        console.error('Error uploading file to storage:', lastUploadError);
        throw new Error(`Failed to upload file to storage: ${lastUploadError.message}`);
      }

      return uniqueFilename;
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      throw new Error(error?.message || 'Failed to upload attachment');
    }
  }

  async getAttachmentUrl(storagePath: string, fallbackFilename?: string): Promise<string> {
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      return storagePath;
    }

    if (storagePath.startsWith('file://') || storagePath.startsWith('content://')) {
      return storagePath;
    }

    try {
      return await getSignedUrlFromStorage(storagePath, fallbackFilename);
    } catch {
      return storagePath;
    }
  }

  private async loadProductionWithRelations(prodData: any): Promise<Production> {
    const productionId = prodData.id;

    // Load items
    const { data: itemsData } = await supabase
      .from('production_items')
      .select('*')
      .eq('production_id', productionId);

    const items: ProductionItem[] = (itemsData || []).map((item: any) => ({
      id: item.id,
      glassId: item.glass_id,
      glassType: item.glass_type,
      quantity: item.quantity,
      areaM2: item.area_m2,
      structureType: item.structure_type,
      paintType: item.paint_type,
    }));

    // Load attachments
    const { data: attachmentsData } = await supabase
      .from('production_attachments')
      .select('*')
      .eq('production_id', productionId);

    const attachments: ProductionAttachment[] = await Promise.all(
      (attachmentsData || []).map(async (att: any) => {
        const rawStoragePath: string = att.storage_path ?? '';
        const displayName =
          att.original_name ||
          getOriginalNameFromStorageKey(rawStoragePath) ||
          att.filename;
        try {
          const url = await this.getAttachmentUrl(rawStoragePath, displayName);
          return {
            id: att.id,
            filename: displayName,
            originalName: displayName,
            mimeType: att.mime_type,
            storagePath: url,
            originalStoragePath: rawStoragePath,
            createdAt: att.created_at,
          };
        } catch (error) {
          console.warn('Failed to get URL for attachment:', displayName, error);
          return {
            id: att.id,
            filename: displayName,
            originalName: displayName,
            mimeType: att.mime_type,
            storagePath: rawStoragePath,
            originalStoragePath: rawStoragePath,
            createdAt: att.created_at,
          };
        }
      })
    );

    return {
      id: prodData.id,
      clientId: prodData.client_id || undefined,
      clientName: prodData.client_name,
      orderNumber: prodData.order_number,
      orderType: prodData.order_type,
      dueDate: prodData.due_date,
      status: prodData.status as ProductionStatus,
      items,
      attachments,
      linkedWorkOrderId: prodData.linked_work_order_id || undefined,
      company: prodData.company ?? undefined,
      createdAt: prodData.created_at,
      createdBy: prodData.created_by,
    };
  }

  private mapToStatusHistory(data: any): ProductionStatusHistory {
    return {
      id: data.id,
      productionId: data.production_id,
      previousStatus: data.previous_status as ProductionStatus,
      newStatus: data.new_status as ProductionStatus,
      changedBy: data.changed_by,
      changedAt: data.changed_at,
    };
  }
}
