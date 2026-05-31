import { Platform } from 'react-native';
import { ManualsRepository } from '../../services/repositories/interfaces';
import { Manual, ManualAttachment } from '../../types';
import { supabase } from '../../services/supabase';
import { getCachedSignedUrl } from '../../utils/signed-url-cache';

const BUCKET_NAME = 'documents';

export class SupabaseManualsRepository implements ManualsRepository {
  async getAllManuals(): Promise<Manual[]> {
    const { data, error } = await supabase
      .from('manuals')
      .select('*')
      .order('title', { ascending: true });

    if (error) {
      console.error('Error fetching manuals:', error);
      throw new Error('Failed to fetch manuals');
    }

    const manuals = await Promise.all(
      (data || []).map(async (row) => {
        const manual = this.mapToManual(row);
        const { data: attachmentsData } = await supabase
          .from('manual_attachments')
          .select('*')
          .eq('manual_id', manual.id)
          .order('created_at', { ascending: false });
        manual.attachments = (attachmentsData || []).map(this.mapToManualAttachment);
        return manual;
      })
    );
    return manuals.sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }));
  }

  async getManualById(manualId: string): Promise<Manual | null> {
    const { data, error } = await supabase
      .from('manuals')
      .select('*')
      .eq('id', manualId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching manual:', error);
      throw new Error('Failed to fetch manual');
    }
    if (!data) return null;

    const manual = this.mapToManual(data);
    const { data: attachmentsData } = await supabase
      .from('manual_attachments')
      .select('*')
      .eq('manual_id', manualId)
      .order('created_at', { ascending: false });
    manual.attachments = (attachmentsData || []).map(this.mapToManualAttachment);
    return manual;
  }

  async createManual(manual: Omit<Manual, 'id' | 'createdAt' | 'attachments'>): Promise<Manual> {
    const insertData: Record<string, unknown> = { title: manual.title };
    if (manual.thumbnailPath != null) insertData.thumbnail_path = manual.thumbnailPath;
    const { data, error } = await supabase
      .from('manuals')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error('Error creating manual:', error);
      throw new Error('Failed to create manual');
    }
    return this.mapToManual(data);
  }

  async updateManual(manualId: string, updates: Partial<Pick<Manual, 'title' | 'thumbnailPath'>>): Promise<Manual> {
    if (updates.thumbnailPath === null) {
      const { data: current } = await supabase.from('manuals').select('thumbnail_path').eq('id', manualId).maybeSingle();
      if (current?.thumbnail_path) {
        const filename = current.thumbnail_path.includes('/') ? current.thumbnail_path.split('/').pop() : current.thumbnail_path;
        await supabase.storage.from(BUCKET_NAME).remove([filename || current.thumbnail_path]);
      }
    }
    const updateData: Record<string, unknown> = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.thumbnailPath !== undefined) updateData.thumbnail_path = updates.thumbnailPath;

    const { data, error } = await supabase
      .from('manuals')
      .update(updateData)
      .eq('id', manualId)
      .select()
      .single();

    if (error) {
      console.error('Error updating manual:', error);
      throw new Error('Failed to update manual');
    }
    return this.mapToManual(data);
  }

  async deleteManual(manualId: string): Promise<void> {
    const manual = await this.getManualById(manualId);
    if (manual?.attachments?.length) {
      for (const att of manual.attachments) {
        const filename = att.storagePath.includes('/')
          ? att.storagePath.split('/').pop()
          : att.storagePath.replace(`${BUCKET_NAME}/`, '');
        await supabase.storage.from(BUCKET_NAME).remove([filename || att.storagePath]);
      }
    }
    if (manual?.thumbnailPath) {
      const thumbFile = manual.thumbnailPath.includes('/') ? manual.thumbnailPath.split('/').pop() : manual.thumbnailPath;
      await supabase.storage.from(BUCKET_NAME).remove([thumbFile || manual.thumbnailPath]);
    }
    const { error } = await supabase.from('manuals').delete().eq('id', manualId);
    if (error) {
      console.error('Error deleting manual:', error);
      throw new Error('Failed to delete manual');
    }
  }

  async addManualAttachment(
    manualId: string,
    file: File | { uri: string; name: string; type: string }
  ): Promise<ManualAttachment> {
    const filename = 'name' in file ? file.name : file.uri.split('/').pop() || 'unknown';
    const mimeType = 'type' in file ? file.type : 'application/pdf';
    const fileUri = 'uri' in file ? file.uri : '';
    const uniqueFilename = `manuals_${manualId}_${Date.now()}_${filename}`;

    let fileData: Blob | Uint8Array;
    if (Platform.OS === 'web' && typeof fetch !== 'undefined' && fileUri) {
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
      console.error('Error uploading manual attachment:', uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message || 'Unknown error'}`);
    }

    const storagePath = `${BUCKET_NAME}/${uniqueFilename}`;
    const { data: attachmentData, error: attachmentError } = await supabase
      .from('manual_attachments')
      .insert({
        manual_id: manualId,
        filename,
        mime_type: mimeType,
        storage_path: storagePath,
      })
      .select()
      .single();

    if (attachmentError) {
      await supabase.storage.from(BUCKET_NAME).remove([uniqueFilename]);
      console.error('Error creating manual attachment record:', attachmentError);
      throw new Error(`Failed to create attachment record: ${attachmentError.message || 'Unknown error'}`);
    }
    return this.mapToManualAttachment(attachmentData);
  }

  async deleteManualAttachment(attachmentId: string): Promise<void> {
    const { data: attachment, error: fetchError } = await supabase
      .from('manual_attachments')
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

    const { error } = await supabase.from('manual_attachments').delete().eq('id', attachmentId);
    if (error) {
      console.error('Error deleting manual attachment:', error);
      throw new Error('Failed to delete attachment');
    }
  }

  async getManualAttachmentUrl(attachmentId: string): Promise<string> {
    const { data: attachment, error } = await supabase
      .from('manual_attachments')
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

  async uploadManualThumbnail(manualId: string, file: { uri: string; name: string; type: string }): Promise<string> {
    const { data: current } = await supabase.from('manuals').select('thumbnail_path').eq('id', manualId).maybeSingle();
    if (current?.thumbnail_path) {
      const oldFile = current.thumbnail_path.includes('/') ? current.thumbnail_path.split('/').pop() : current.thumbnail_path;
      await supabase.storage.from(BUCKET_NAME).remove([oldFile || current.thumbnail_path]);
    }
    const filename = file.name || file.uri.split('/').pop() || `thumb_${Date.now()}.jpg`;
    const mimeType = file.type || 'image/jpeg';
    const uniqueFilename = `manuals_${manualId}_thumb_${Date.now()}_${filename}`;

    let fileData: Blob | Uint8Array;
    if (Platform.OS === 'web' && typeof fetch !== 'undefined') {
      const response = await fetch(file.uri);
      fileData = await response.blob();
    } else if (file.uri.startsWith('file://') || file.uri.startsWith('content://')) {
      const { File } = require('expo-file-system');
      const sourceFile = new File(file.uri);
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
      console.error('Error uploading manual thumbnail:', uploadError);
      throw new Error(`Failed to upload thumbnail: ${uploadError.message}`);
    }

    await this.updateManual(manualId, { thumbnailPath: uniqueFilename });
    return uniqueFilename;
  }

  async getManualThumbnailUrl(manualId: string): Promise<string> {
    const { data: manual, error } = await supabase
      .from('manuals')
      .select('thumbnail_path')
      .eq('id', manualId)
      .maybeSingle();

    if (error || !manual?.thumbnail_path) return '';

    const filename = manual.thumbnail_path.includes('/')
      ? manual.thumbnail_path.split('/').pop()
      : manual.thumbnail_path;
    return getCachedSignedUrl(filename || manual.thumbnail_path);
  }

  private mapToManual(data: any): Manual {
    return {
      id: data.id,
      title: data.title,
      thumbnailPath: data.thumbnail_path ?? undefined,
      createdAt: data.created_at,
    };
  }

  private mapToManualAttachment(data: any): ManualAttachment {
    return {
      id: data.id,
      manualId: data.manual_id,
      filename: data.filename,
      mimeType: data.mime_type,
      storagePath: data.storage_path,
      createdAt: data.created_at,
    };
  }
}
