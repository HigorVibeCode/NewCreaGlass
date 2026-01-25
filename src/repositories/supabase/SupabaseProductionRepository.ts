import { ProductionRepository } from '../../services/repositories/interfaces';
import { Production, ProductionItem, ProductionAttachment, ProductionStatus, ProductionStatusHistory } from '../../types';
import { supabase } from '../../services/supabase';
import { File } from 'expo-file-system';

const BUCKET_NAME = 'documents';

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

    // Load relations for each production
    const productions = await Promise.all(
      (data || []).map(async (prod) => await this.loadProductionWithRelations(prod))
    );

    return productions;
  }

  async getProductionById(productionId: string): Promise<Production | null> {
    const { data, error } = await supabase
      .from('productions')
      .select('*')
      .eq('id', productionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
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
        client_name: production.clientName,
        order_number: production.orderNumber,
        order_type: production.orderType,
        due_date: production.dueDate,
        status: production.status,
        created_by: user.id,
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

    // Upload attachments if any
    if (production.attachments && production.attachments.length > 0) {
      for (const attachment of production.attachments) {
        // If attachment has a local file URI, upload it
        if (attachment.storagePath.startsWith('file://') || attachment.storagePath.startsWith('content://')) {
          try {
            const filename = await this.uploadAttachment({
              uri: attachment.storagePath,
              name: attachment.filename,
              type: attachment.mimeType,
            });
            attachment.storagePath = filename;
          } catch (uploadError) {
            console.error('Error uploading attachment:', uploadError);
            // Continue with other attachments
          }
        }

        await supabase
          .from('production_attachments')
          .insert({
            production_id: productionId,
            filename: attachment.filename,
            mime_type: attachment.mimeType,
            storage_path: attachment.storagePath,
          });
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
    if (updates.orderNumber !== undefined) updateData.order_number = updates.orderNumber;
    if (updates.orderType !== undefined) updateData.order_type = updates.orderType;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
    if (updates.status !== undefined) updateData.status = updates.status;

    // Get current production to check status change
    const currentProduction = await this.getProductionById(productionId);
    if (!currentProduction) {
      throw new Error('Production not found');
    }

    const previousStatus = currentProduction.status;

    const { data, error } = await supabase
      .from('productions')
      .update(updateData)
      .eq('id', productionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating production:', error);
      throw new Error('Failed to update production');
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
      // Note: This is a simple replace strategy
      // Delete existing attachments
      await supabase
        .from('production_attachments')
        .delete()
        .eq('production_id', productionId);

      // Upload and insert new attachments
      for (const attachment of updates.attachments) {
        let storagePath = attachment.storagePath;

        // If attachment has a local file URI, upload it
        if (storagePath.startsWith('file://') || storagePath.startsWith('content://')) {
          try {
            const filename = await this.uploadAttachment({
              uri: storagePath,
              name: attachment.filename,
              type: attachment.mimeType,
            });
            storagePath = filename;
          } catch (uploadError) {
            console.error('Error uploading attachment:', uploadError);
            continue;
          }
        }

        await supabase
          .from('production_attachments')
          .insert({
            production_id: productionId,
            filename: attachment.filename,
            mime_type: attachment.mimeType,
            storage_path: storagePath,
          });
      }
    }

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
              clientName: data.client_name || '',
              orderType: data.order_type || '',
              orderNumber: data.order_number || '',
              productionId: productionId,
            },
            createdBySystem: true,
          });
        } catch (notifError) {
          console.error('Error creating authorized notification:', notifError);
          // Don't throw - notification is secondary, status update was successful
        }
      }
    }

    return await this.loadProductionWithRelations(data);
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

  async uploadAttachment(file: { uri: string; name: string; type: string }): Promise<string> {
    const filename = file.name;
    const fileUri = file.uri;
    const mimeType = file.type;

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}_${filename}`;
    const storagePath = `${BUCKET_NAME}/${uniqueFilename}`;

    try {
      let fileData: Blob | Uint8Array | string;

      if (fileUri.startsWith('file://') || fileUri.startsWith('content://')) {
        // React Native - read file as base64 and convert to Uint8Array
        const sourceFile = new File(fileUri);
        const base64 = await sourceFile.base64();

        // Convert base64 to Uint8Array for Supabase Storage
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
        console.error('Error uploading file to storage:', uploadError);
        throw new Error(`Failed to upload file to storage: ${uploadError.message}`);
      }

      return uniqueFilename; // Return just the filename, not full path
    } catch (error: any) {
      console.error('Error uploading attachment:', error);
      throw new Error(error?.message || 'Failed to upload attachment');
    }
  }

  async getAttachmentUrl(storagePath: string): Promise<string> {
    // If already a URL (http/https), return as is
    if (storagePath.startsWith('http://') || storagePath.startsWith('https://')) {
      return storagePath;
    }

    // Skip if it's a local file URI (file:// or content://)
    if (storagePath.startsWith('file://') || storagePath.startsWith('content://')) {
      return storagePath;
    }

    // Extract filename from storage path
    // storagePath can be: "documents/filename.jpg", "documents/123_filename.jpg", or just "filename.jpg"
    let filename = storagePath;
    
    // Remove bucket name prefix if present
    if (storagePath.startsWith(`${BUCKET_NAME}/`)) {
      filename = storagePath.replace(`${BUCKET_NAME}/`, '');
    } else if (storagePath.includes('/')) {
      // If it has slashes but doesn't start with bucket name, get the last part
      const parts = storagePath.split('/');
      filename = parts[parts.length - 1];
    }

    // Remove any leading/trailing slashes and whitespace
    filename = filename.trim().replace(/^\/+|\/+$/g, '');

    if (!filename) {
      // Silently return original path for invalid paths
      return storagePath;
    }

    try {
      // Get signed URL from Supabase Storage (valid for 1 hour)
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .createSignedUrl(filename, 3600);

      if (error) {
        // Silently handle "not found" errors - these are expected for missing files
        // Only log other types of errors
        const isNotFoundError = 
          error.message?.includes('not found') || 
          error.message?.includes('Object not found') ||
          error.message?.includes('The resource was not found');
        
        if (!isNotFoundError) {
          console.warn('Error getting attachment URL:', error.message);
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
        console.warn('Exception getting attachment URL:', error?.message);
      }
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
        try {
          // Get signed URL for attachment (only if it's not already a URL)
          const url = await this.getAttachmentUrl(att.storage_path);
          return {
            id: att.id,
            filename: att.filename,
            mimeType: att.mime_type,
            storagePath: url,
            createdAt: att.created_at,
          };
        } catch (error) {
          // If getting URL fails, use original storage path
          console.warn('Failed to get URL for attachment:', att.filename, error);
          return {
            id: att.id,
            filename: att.filename,
            mimeType: att.mime_type,
            storagePath: att.storage_path,
            createdAt: att.created_at,
          };
        }
      })
    );

    return {
      id: prodData.id,
      clientName: prodData.client_name,
      orderNumber: prodData.order_number,
      orderType: prodData.order_type,
      dueDate: prodData.due_date,
      status: prodData.status as ProductionStatus,
      items,
      attachments,
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
