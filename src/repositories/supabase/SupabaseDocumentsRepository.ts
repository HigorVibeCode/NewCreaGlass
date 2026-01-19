import { DocumentsRepository } from '../../services/repositories/interfaces';
import { Document } from '../../types';
import { supabase } from '../../services/supabase';
import { File } from 'expo-file-system';

const BUCKET_NAME = 'documents';

export class SupabaseDocumentsRepository implements DocumentsRepository {
  async getAllDocuments(): Promise<Document[]> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching documents:', error);
      throw new Error('Failed to fetch documents');
    }

    return (data || []).map(this.mapToDocument);
  }

  async getDocumentById(documentId: string): Promise<Document | null> {
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching document:', error);
      throw new Error('Failed to fetch document');
    }

    return data ? this.mapToDocument(data) : null;
  }

  async uploadDocument(
    file: File | { uri: string; name: string; type: string },
    userId: string
  ): Promise<Document> {
    const filename = 'name' in file ? file.name : file.uri.split('/').pop() || 'unknown';
    const mimeType = 'type' in file ? file.type : 'application/octet-stream';
    const fileUri = 'uri' in file ? file.uri : '';
    
    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}_${filename}`;
    const storagePath = `${BUCKET_NAME}/${uniqueFilename}`;

    try {
      // Read file and prepare for upload
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
      } else if ('uri' in file && typeof fetch !== 'undefined') {
        // Try to fetch the file as blob (web/Expo Web)
        const response = await fetch(file.uri);
        fileData = await response.blob();
      } else {
        throw new Error('Unsupported file type or environment');
      }

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(uniqueFilename, fileData, {
          contentType: mimeType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Error uploading file to storage:', uploadError);
        console.error('Upload error details:', JSON.stringify(uploadError, null, 2));
        console.error('File info:', { filename, mimeType, uniqueFilename, fileSize: fileData instanceof Uint8Array ? fileData.length : 'unknown' });
        throw new Error(`Failed to upload file to storage: ${uploadError.message || 'Unknown error'}`);
      }

      // Get current authenticated user from Supabase session
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        // Clean up uploaded file
        await supabase.storage.from(BUCKET_NAME).remove([uniqueFilename]);
        throw new Error('User not authenticated');
      }

      // Create document record
      // Use auth.uid() instead of userId parameter to ensure RLS policy passes
      const { data: docData, error: docError } = await supabase
        .from('documents')
        .insert({
          filename,
          mime_type: mimeType,
          storage_path: storagePath,
          created_by: authUser.id, // Use auth.uid() from Supabase session
        })
        .select()
        .single();

      if (docError) {
        // Clean up uploaded file if document creation fails
        await supabase.storage.from(BUCKET_NAME).remove([uniqueFilename]);
        console.error('Error creating document record:', docError);
        console.error('Document error details:', JSON.stringify(docError, null, 2));
        throw new Error(`Failed to create document record: ${docError.message || 'Unknown error'}`);
      }

      return this.mapToDocument(docData);
    } catch (error: any) {
      console.error('Error uploading document:', error);
      console.error('Full error:', JSON.stringify(error, null, 2));
      const errorMessage = error?.message || error?.toString() || 'Failed to upload document';
      throw new Error(errorMessage);
    }
  }

  async getDocumentUrl(documentId: string): Promise<string> {
    const document = await this.getDocumentById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Extract filename from storage path
    const filename = document.storagePath.includes('/') 
      ? document.storagePath.split('/').pop() 
      : document.storagePath;

    // Get signed URL from Supabase Storage (valid for 1 hour)
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(filename || document.storagePath, 3600);

    if (error) {
      console.error('Error getting document URL:', error);
      // Fallback to storage path if signed URL fails
      return document.storagePath;
    }

    return data.signedUrl;
  }

  async deleteDocument(documentId: string): Promise<void> {
    const document = await this.getDocumentById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

      // Delete from storage
      const filename = document.storagePath.includes('/') 
        ? document.storagePath.split('/').pop() 
        : document.storagePath.replace(`${BUCKET_NAME}/`, '');
      await supabase.storage.from(BUCKET_NAME).remove([filename || document.storagePath]);

    // Delete document record
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (error) {
      console.error('Error deleting document:', error);
      throw new Error('Failed to delete document');
    }
  }

  private mapToDocument(data: any): Document {
    return {
      id: data.id,
      filename: data.filename,
      mimeType: data.mime_type,
      storagePath: data.storage_path,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }
}
