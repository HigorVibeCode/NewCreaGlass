import { Platform } from 'react-native';
import { EquipmentDocumentsRepository } from '../../services/repositories/interfaces';
import { EquipmentMachine, EquipmentDocument, EquipmentDocumentAttachment } from '../../types';
import { supabase } from '../../services/supabase';
import { getCachedSignedUrl } from '../../utils/signed-url-cache';

const BUCKET_NAME = 'documents';

export class SupabaseEquipmentDocumentsRepository implements EquipmentDocumentsRepository {
  // ===================== Equipment Machines (folders) =====================

  async getAllEquipment(): Promise<EquipmentMachine[]> {
    const { data, error } = await supabase
      .from('equipment_machines')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching equipment:', error);
      throw new Error('Failed to fetch equipment');
    }
    return (data || []).map(this.mapToEquipment);
  }

  async getEquipmentById(equipmentId: string): Promise<EquipmentMachine | null> {
    const { data, error } = await supabase
      .from('equipment_machines')
      .select('*')
      .eq('id', equipmentId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching equipment:', error);
      throw new Error('Failed to fetch equipment');
    }
    return data ? this.mapToEquipment(data) : null;
  }

  async createEquipment(equipment: Omit<EquipmentMachine, 'id' | 'createdAt'>): Promise<EquipmentMachine> {
    const { data, error } = await supabase
      .from('equipment_machines')
      .insert({
        name: equipment.name,
        icon: equipment.icon || 'hardware',
        created_by: equipment.createdBy,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating equipment:', error);
      throw new Error('Failed to create equipment');
    }
    return this.mapToEquipment(data);
  }

  async updateEquipment(equipmentId: string, updates: Partial<Pick<EquipmentMachine, 'name' | 'icon'>>): Promise<EquipmentMachine> {
    const updateData: Record<string, unknown> = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.icon !== undefined) updateData.icon = updates.icon;

    const { data, error } = await supabase
      .from('equipment_machines')
      .update(updateData)
      .eq('id', equipmentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating equipment:', error);
      throw new Error('Failed to update equipment');
    }
    return this.mapToEquipment(data);
  }

  async deleteEquipment(equipmentId: string): Promise<void> {
    // First delete all documents and their attachments
    const docs = await this.getDocumentsByEquipment(equipmentId);
    for (const doc of docs) {
      await this.deleteDocument(doc.id);
    }

    const { error } = await supabase
      .from('equipment_machines')
      .delete()
      .eq('id', equipmentId);

    if (error) {
      console.error('Error deleting equipment:', error);
      throw new Error('Failed to delete equipment');
    }
  }

  // ===================== Equipment Documents (blocks) =====================

  async getDocumentsByEquipment(equipmentId: string): Promise<EquipmentDocument[]> {
    const { data, error } = await supabase
      .from('equipment_documents')
      .select('*')
      .eq('equipment_id', equipmentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching equipment documents:', error);
      throw new Error('Failed to fetch equipment documents');
    }

    const rows = data || [];
    if (rows.length === 0) return [];

    const docIds = rows.map((r: any) => r.id);

    const { data: allAttachments } = await supabase
      .from('equipment_document_attachments')
      .select('*')
      .in('document_id', docIds)
      .order('created_at', { ascending: true });

    const attsByDoc = new Map<string, EquipmentDocumentAttachment[]>();
    for (const att of allAttachments || []) {
      const did = att.document_id;
      if (!attsByDoc.has(did)) attsByDoc.set(did, []);
      attsByDoc.get(did)!.push(this.mapToAttachment(att));
    }

    return rows.map((row: any) => {
      const doc = this.mapToDocument(row);
      doc.attachments = attsByDoc.get(doc.id) || [];
      return doc;
    });
  }

  async getDocumentById(documentId: string): Promise<EquipmentDocument | null> {
    const { data, error } = await supabase
      .from('equipment_documents')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching equipment document:', error);
      throw new Error('Failed to fetch equipment document');
    }
    if (!data) return null;

    const doc = this.mapToDocument(data);
    const { data: attachmentsData } = await supabase
      .from('equipment_document_attachments')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: true });
    doc.attachments = (attachmentsData || []).map(this.mapToAttachment);
    return doc;
  }

  async createDocument(doc: Omit<EquipmentDocument, 'id' | 'createdAt' | 'updatedAt' | 'attachments'>): Promise<EquipmentDocument> {
    const insertData: Record<string, unknown> = {
      equipment_id: doc.equipmentId,
      title: doc.title,
      created_by: doc.createdBy,
    };
    if (doc.description != null) insertData.description = doc.description;
    if (doc.thumbnailPath != null) insertData.thumbnail_path = doc.thumbnailPath;

    const { data, error } = await supabase
      .from('equipment_documents')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating equipment document:', error);
      throw new Error('Failed to create equipment document');
    }
    return this.mapToDocument(data);
  }

  async updateDocument(documentId: string, updates: Partial<Pick<EquipmentDocument, 'title' | 'description' | 'thumbnailPath'>>): Promise<EquipmentDocument> {
    // If thumbnail is being removed, clean up storage
    if (updates.thumbnailPath === null) {
      const { data: current } = await supabase
        .from('equipment_documents')
        .select('thumbnail_path')
        .eq('id', documentId)
        .maybeSingle();
      if (current?.thumbnail_path) {
        const filename = current.thumbnail_path.includes('/')
          ? current.thumbnail_path.split('/').pop()
          : current.thumbnail_path;
        await supabase.storage.from(BUCKET_NAME).remove([filename || current.thumbnail_path]);
      }
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.thumbnailPath !== undefined) updateData.thumbnail_path = updates.thumbnailPath;

    const { data, error } = await supabase
      .from('equipment_documents')
      .update(updateData)
      .eq('id', documentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating equipment document:', error);
      throw new Error('Failed to update equipment document');
    }
    return this.mapToDocument(data);
  }

  async deleteDocument(documentId: string): Promise<void> {
    const doc = await this.getDocumentById(documentId);
    if (doc?.attachments?.length) {
      for (const att of doc.attachments) {
        const filename = att.storagePath.includes('/')
          ? att.storagePath.split('/').pop()
          : att.storagePath.replace(`${BUCKET_NAME}/`, '');
        await supabase.storage.from(BUCKET_NAME).remove([filename || att.storagePath]);
      }
    }
    if (doc?.thumbnailPath) {
      const thumbFile = doc.thumbnailPath.includes('/')
        ? doc.thumbnailPath.split('/').pop()
        : doc.thumbnailPath;
      await supabase.storage.from(BUCKET_NAME).remove([thumbFile || doc.thumbnailPath]);
    }

    const { error } = await supabase
      .from('equipment_documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      console.error('Error deleting equipment document:', error);
      throw new Error('Failed to delete equipment document');
    }
  }

  // ===================== Attachments =====================

  async addDocumentAttachment(
    documentId: string,
    file: File | { uri: string; name: string; type: string }
  ): Promise<EquipmentDocumentAttachment> {
    const originalName = 'name' in file ? file.name : file.uri.split('/').pop() || 'unknown';
    const mimeType = 'type' in file ? file.type : 'application/octet-stream';
    const fileUri = 'uri' in file ? file.uri : '';

    // Generate a friendly display name with date/time
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dateStr = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
    const timeStr = `${pad(now.getHours())}h${pad(now.getMinutes())}`;
    const ext = originalName.includes('.') ? originalName.substring(originalName.lastIndexOf('.')) : '';
    const typeLabel = mimeType.startsWith('image/') ? 'Foto' : mimeType.startsWith('video/') ? 'Video' : 'Arquivo';
    const displayFilename = `${typeLabel}_${dateStr}_${timeStr}${ext}`;

    const uniqueFilename = `equip_${documentId}_${Date.now()}${ext}`;

    let fileData: Blob | Uint8Array;
    if (Platform.OS === 'web' && typeof fetch !== 'undefined' && fileUri) {
      const response = await fetch(fileUri);
      fileData = await response.blob();
    } else if (fileUri.startsWith('file://') || fileUri.startsWith('content://')) {
      const { File: ExpoFile } = require('expo-file-system');
      const sourceFile = new ExpoFile(fileUri);
      const base64 = await sourceFile.base64();
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      fileData = new Uint8Array(byteNumbers);
    } else if (typeof window !== 'undefined' && file instanceof File) {
      fileData = file;
    } else if ('uri' in file && typeof fetch !== 'undefined') {
      const response = await fetch(file.uri);
      fileData = await response.blob();
    } else {
      throw new Error('Unsupported file type or environment');
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(uniqueFilename, fileData, { contentType: mimeType, upsert: false });

    if (uploadError) {
      console.error('Error uploading equipment doc attachment:', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message || 'Unknown error'}`);
    }

    const storagePath = `${BUCKET_NAME}/${uniqueFilename}`;
    const { data: attachmentData, error: attachmentError } = await supabase
      .from('equipment_document_attachments')
      .insert({
        document_id: documentId,
        filename: displayFilename,
        mime_type: mimeType,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (attachmentError) {
      await supabase.storage.from(BUCKET_NAME).remove([uniqueFilename]);
      console.error('Error creating equipment doc attachment record:', attachmentError);
      throw new Error(`Failed to create attachment record: ${attachmentError.message || 'Unknown error'}`);
    }
    return this.mapToAttachment(attachmentData);
  }

  async deleteDocumentAttachment(attachmentId: string): Promise<void> {
    const { data: attachment, error: fetchError } = await supabase
      .from('equipment_document_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .maybeSingle();

    if (fetchError || !attachment) {
      throw new Error('Attachment not found');
    }

    const filename = attachment.storage_path.includes('/')
      ? attachment.storage_path.split('/').pop()
      : attachment.storage_path.replace(`${BUCKET_NAME}/`, '');
    await supabase.storage.from(BUCKET_NAME).remove([filename || attachment.storage_path]);

    const { error } = await supabase
      .from('equipment_document_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) {
      console.error('Error deleting equipment doc attachment:', error);
      throw new Error('Failed to delete attachment');
    }
  }

  async getDocumentAttachmentUrl(attachmentId: string): Promise<string> {
    const { data: attachment, error } = await supabase
      .from('equipment_document_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .maybeSingle();

    if (error || !attachment) {
      throw new Error('Attachment not found');
    }

    const filename = attachment.storage_path.includes('/')
      ? attachment.storage_path.split('/').pop()
      : attachment.storage_path.replace(`${BUCKET_NAME}/`, '');
    const url = await getCachedSignedUrl(filename || attachment.storage_path);
    return url || attachment.storage_path;
  }

  // ===================== Thumbnail =====================

  async uploadDocumentThumbnail(documentId: string, file: { uri: string; name: string; type: string }): Promise<string> {
    // Remove old thumbnail if exists
    const { data: current } = await supabase
      .from('equipment_documents')
      .select('thumbnail_path')
      .eq('id', documentId)
      .maybeSingle();
    if (current?.thumbnail_path) {
      const oldFile = current.thumbnail_path.includes('/')
        ? current.thumbnail_path.split('/').pop()
        : current.thumbnail_path;
      await supabase.storage.from(BUCKET_NAME).remove([oldFile || current.thumbnail_path]);
    }

    const filename = file.name || file.uri.split('/').pop() || `thumb_${Date.now()}.jpg`;
    const mimeType = file.type || 'image/jpeg';
    const uniqueFilename = `equip_${documentId}_thumb_${Date.now()}_${filename}`;

    let fileData: Blob | Uint8Array;
    if (Platform.OS === 'web' && typeof fetch !== 'undefined') {
      const response = await fetch(file.uri);
      fileData = await response.blob();
    } else if (file.uri.startsWith('file://') || file.uri.startsWith('content://')) {
      const { File: ExpoFile } = require('expo-file-system');
      const sourceFile = new ExpoFile(file.uri);
      const base64 = await sourceFile.base64();
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      fileData = new Uint8Array(byteNumbers);
    } else if (typeof fetch !== 'undefined') {
      const response = await fetch(file.uri);
      fileData = await response.blob();
    } else {
      throw new Error('Unsupported environment for thumbnail upload');
    }

    const { error: uploadError } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(uniqueFilename, fileData, { contentType: mimeType, upsert: true });

    if (uploadError) {
      console.error('Error uploading equipment doc thumbnail:', uploadError);
      throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
    }

    await this.updateDocument(documentId, { thumbnailPath: uniqueFilename });
    return uniqueFilename;
  }

  async getDocumentThumbnailUrl(documentId: string): Promise<string> {
    const { data: doc, error } = await supabase
      .from('equipment_documents')
      .select('thumbnail_path')
      .eq('id', documentId)
      .maybeSingle();

    if (error || !doc?.thumbnail_path) return '';

    const filename = doc.thumbnail_path.includes('/')
      ? doc.thumbnail_path.split('/').pop()
      : doc.thumbnail_path;
    return getCachedSignedUrl(filename || doc.thumbnail_path);
  }

  // ===================== Mappers =====================

  private mapToEquipment(data: any): EquipmentMachine {
    return {
      id: data.id,
      name: data.name,
      icon: data.icon ?? undefined,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }

  private mapToDocument(data: any): EquipmentDocument {
    return {
      id: data.id,
      equipmentId: data.equipment_id,
      title: data.title,
      description: data.description ?? undefined,
      thumbnailPath: data.thumbnail_path ?? undefined,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapToAttachment(data: any): EquipmentDocumentAttachment {
    return {
      id: data.id,
      documentId: data.document_id,
      filename: data.filename,
      mimeType: data.mime_type,
      storagePath: data.storage_path,
      createdAt: data.created_at,
    };
  }
}
