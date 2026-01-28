import { ManualsRepository } from '../../services/repositories/interfaces';
import { Manual, ManualAttachment } from '../../types';
import { supabase } from '../../services/supabase';
import { File } from 'expo-file-system';

const BUCKET_NAME = 'documents';

export class SupabaseManualsRepository implements ManualsRepository {
  async getAllManuals(): Promise<Manual[]> {
    const { data, error } = await supabase
      .from('manuals')
      .select('*')
      .order('created_at', { ascending: false });

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
    return manuals;
  }

  async getManualById(manualId: string): Promise<Manual | null> {
    const { data, error } = await supabase
      .from('manuals')
      .select('*')
      .eq('id', manualId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
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
    const { data, error } = await supabase
      .from('manuals')
      .insert({ title: manual.title })
      .select()
      .single();

    if (error) {
      console.error('Error creating manual:', error);
      throw new Error('Failed to create manual');
    }
    return this.mapToManual(data);
  }

  async updateManual(manualId: string, updates: Partial<Pick<Manual, 'title'>>): Promise<Manual> {
    const updateData: Record<string, unknown> = {};
    if (updates.title !== undefined) updateData.title = updates.title;

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
    if (fileUri.startsWith('file://') || fileUri.startsWith('content://')) {
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
      .single();

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
      .single();

    if (error || !attachment) {
      throw new Error('Attachment not found');
    }

    const filename = attachment.storage_path.includes('/')
      ? attachment.storage_path.split('/').pop()
      : attachment.storage_path.replace(`${BUCKET_NAME}/`, '');
    const { data, error: urlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filename || attachment.storage_path, 3600);

    if (urlError) {
      console.error('Error getting attachment URL:', urlError);
      return attachment.storage_path;
    }
    return data.signedUrl;
  }

  private mapToManual(data: any): Manual {
    return {
      id: data.id,
      title: data.title,
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
