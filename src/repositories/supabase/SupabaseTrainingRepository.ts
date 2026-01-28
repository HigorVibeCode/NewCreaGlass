import { TrainingRepository } from '../../services/repositories/interfaces';
import { Training, TrainingCategory, TrainingCompletion, TrainingSignature, TrainingWithCompletion, TrainingAttachment } from '../../types';
import { supabase } from '../../services/supabase';
import { File } from 'expo-file-system';

const SIGNATURES_BUCKET = 'signatures';

export class SupabaseTrainingRepository implements TrainingRepository {
  async getAllTrainings(category?: TrainingCategory): Promise<Training[]> {
    let query = supabase
      .from('trainings')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (category) {
      query = query.eq('category', category);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching trainings:', error);
      throw new Error('Failed to fetch trainings');
    }

    // Load attachments for each training
    const trainings = await Promise.all(
      (data || []).map(async (trainingData) => {
        const training = this.mapToTraining(trainingData);
        
        // Load attachments
        const { data: attachmentsData } = await supabase
          .from('training_attachments')
          .select('*')
          .eq('training_id', training.id)
          .order('created_at', { ascending: false });

        training.attachments = (attachmentsData || []).map(this.mapToTrainingAttachment);
        return training;
      })
    );

    return trainings;
  }

  async getTrainingById(trainingId: string): Promise<Training | null> {
    const { data, error } = await supabase
      .from('trainings')
      .select('*')
      .eq('id', trainingId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching training:', error);
      throw new Error('Failed to fetch training');
    }

    if (!data) return null;

    // Load attachments
    const { data: attachmentsData } = await supabase
      .from('training_attachments')
      .select('*')
      .eq('training_id', trainingId)
      .order('created_at', { ascending: false });

    const training = this.mapToTraining(data);
    training.attachments = (attachmentsData || []).map(this.mapToTrainingAttachment);
    return training;
  }

  async createTraining(training: Omit<Training, 'id' | 'createdAt' | 'updatedAt'>): Promise<Training> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('trainings')
      .insert({
        title: training.title,
        description: training.description || null,
        category: training.category,
        content: training.content || null,
        duration_minutes: training.durationMinutes || null,
        is_active: training.isActive !== undefined ? training.isActive : true,
        created_by: authUser.id,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating training:', error);
      throw new Error('Failed to create training');
    }

    return this.mapToTraining(data);
  }

  async updateTraining(trainingId: string, updates: Partial<Training>): Promise<Training> {
    const updateData: any = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.category !== undefined) updateData.category = updates.category;
    if (updates.content !== undefined) updateData.content = updates.content;
    if (updates.durationMinutes !== undefined) updateData.duration_minutes = updates.durationMinutes;
    if (updates.isActive !== undefined) updateData.is_active = updates.isActive;

    const { data, error } = await supabase
      .from('trainings')
      .update(updateData)
      .eq('id', trainingId)
      .select()
      .single();

    if (error) {
      console.error('Error updating training:', error);
      throw new Error('Failed to update training');
    }

    return this.mapToTraining(data);
  }

  async deleteTraining(trainingId: string): Promise<void> {
    const { error } = await supabase
      .from('trainings')
      .delete()
      .eq('id', trainingId);

    if (error) {
      console.error('Error deleting training:', error);
      throw new Error('Failed to delete training');
    }
  }

  async startTraining(trainingId: string, userId: string): Promise<TrainingCompletion> {
    // Check if completion already exists
    const existing = await this.getTrainingCompletion(trainingId, userId);
    if (existing) {
      return existing;
    }

    // Create new completion
    const { data, error } = await supabase
      .from('training_completions')
      .insert({
        training_id: trainingId,
        user_id: userId,
        started_at: new Date().toISOString(),
        time_spent_seconds: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('Error starting training:', error);
      throw new Error('Failed to start training');
    }

    return this.mapToTrainingCompletion(data);
  }

  async updateTrainingTime(trainingId: string, userId: string, timeSpentSeconds: number): Promise<TrainingCompletion> {
    // Get or create completion
    let completion = await this.getTrainingCompletion(trainingId, userId);
    if (!completion) {
      completion = await this.startTraining(trainingId, userId);
    }

    const { data, error } = await supabase
      .from('training_completions')
      .update({
        time_spent_seconds: timeSpentSeconds,
      })
      .eq('id', completion.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating training time:', error);
      throw new Error('Failed to update training time');
    }

    return this.mapToTrainingCompletion(data);
  }

  async completeTraining(
    trainingId: string,
    userId: string,
    signatureData: string,
    fullName: string,
    latitude: number,
    longitude: number
  ): Promise<TrainingCompletion> {
    // Get or create completion
    let completion = await this.getTrainingCompletion(trainingId, userId);
    if (!completion) {
      completion = await this.startTraining(trainingId, userId);
    }

    // Upload signature image
    const base64Data = signatureData.replace(/^data:image\/png;base64,/, '');
    const filename = `training_signature_${completion.id}_${Date.now()}.png`;
    
    // Convert base64 to Uint8Array
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const fileData = new Uint8Array(byteNumbers);

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(SIGNATURES_BUCKET)
      .upload(filename, fileData, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('Error uploading signature:', uploadError);
      throw new Error('Failed to upload signature');
    }

    const signaturePath = `${SIGNATURES_BUCKET}/${filename}`;

    // Create signature record
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    // Check if signature already exists for this completion
    const { data: existingSignature } = await supabase
      .from('training_signatures')
      .select('id, signature_path')
      .eq('training_completion_id', completion.id)
      .single();

    let signatureError;

    if (existingSignature) {
      // Update existing signature
      // First, delete old signature file from storage
      if (existingSignature.signature_path) {
        const oldFilename = existingSignature.signature_path.replace(`${SIGNATURES_BUCKET}/`, '');
        await supabase.storage.from(SIGNATURES_BUCKET).remove([oldFilename]);
      }

      // Update signature record
      const { error: updateError } = await supabase
        .from('training_signatures')
        .update({
          signature_path: signaturePath,
          full_name: fullName,
          latitude,
          longitude,
          timestamp: new Date().toISOString(),
        })
        .eq('id', existingSignature.id);

      signatureError = updateError;
    } else {
      // Create new signature record
      const { error: insertError } = await supabase
        .from('training_signatures')
        .insert({
          training_completion_id: completion.id,
          signature_path: signaturePath,
          full_name: fullName,
          latitude,
          longitude,
          created_by: authUser.id,
        });

      signatureError = insertError;
    }

    if (signatureError) {
      console.error('Error creating/updating signature:', signatureError);
      // Try to clean up uploaded file
      await supabase.storage.from(SIGNATURES_BUCKET).remove([filename]);
      throw new Error('Failed to create signature');
    }

    // Update completion with completed_at
    const { data: updatedCompletion, error: completionError } = await supabase
      .from('training_completions')
      .update({
        completed_at: new Date().toISOString(),
      })
      .eq('id', completion.id)
      .select()
      .single();

    if (completionError) {
      console.error('Error updating completion:', completionError);
      throw new Error('Failed to complete training');
    }

    return this.mapToTrainingCompletion(updatedCompletion);
  }

  async getTrainingCompletion(trainingId: string, userId: string): Promise<TrainingCompletion | null> {
    const { data, error } = await supabase
      .from('training_completions')
      .select('*')
      .eq('training_id', trainingId)
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching training completion:', error);
      throw new Error('Failed to fetch training completion');
    }

    return data ? this.mapToTrainingCompletion(data) : null;
  }

  async getSignatureByCompletionId(completionId: string): Promise<TrainingSignature | null> {
    const { data, error } = await supabase
      .from('training_signatures')
      .select('*')
      .eq('training_completion_id', completionId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching signature by completion:', error);
      return null;
    }

    return data ? this.mapToTrainingSignature(data) : null;
  }

  async getCompletedTrainings(userId?: string): Promise<TrainingWithCompletion[]> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    // Check if user is Master
    const { data: userData } = await supabase
      .from('users')
      .select('user_type')
      .eq('id', authUser.id)
      .single();

    const isMaster = userData?.user_type === 'Master';
    const targetUserId = userId || (isMaster ? undefined : authUser.id);

    let query = supabase
      .from('training_completions')
      .select(`
        *,
        trainings (*),
        training_signatures (*)
      `)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    if (targetUserId) {
      query = query.eq('user_id', targetUserId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching completed trainings:', error);
      throw new Error('Failed to fetch completed trainings');
    }

    // Filter only completions that have both completed_at AND signature
    const completedWithSignature = (data || []).filter((item: any) => 
      item.completed_at && item.training_signatures && item.training_signatures.length > 0
    );

    // Load attachments for each training
    const trainings = await Promise.all(
      completedWithSignature.map(async (item: any) => {
        const training = this.mapToTraining(item.trainings);
        
        // Load attachments
        const { data: attachmentsData } = await supabase
          .from('training_attachments')
          .select('*')
          .eq('training_id', training.id)
          .order('created_at', { ascending: false });

        training.attachments = (attachmentsData || []).map(this.mapToTrainingAttachment);

        return {
          ...training,
          completion: this.mapToTrainingCompletion(item),
          signature: item.training_signatures?.[0] ? this.mapToTrainingSignature(item.training_signatures[0]) : undefined,
        };
      })
    );

    return trainings;
  }

  async getTrainingHistory(trainingId: string, userId?: string): Promise<TrainingWithCompletion[]> {
    let query = supabase
      .from('training_completions')
      .select(`
        *,
        trainings (*),
        training_signatures (*)
      `)
      .eq('training_id', trainingId)
      .not('completed_at', 'is', null)
      .order('completed_at', { ascending: false });

    if (userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching training history:', error);
      throw new Error('Failed to fetch training history');
    }

    return (data || []).map((item: any) => ({
      ...this.mapToTraining(item.trainings),
      completion: this.mapToTrainingCompletion(item),
      signature: item.training_signatures?.[0] ? this.mapToTrainingSignature(item.training_signatures[0]) : undefined,
    }));
  }

  private mapToTraining(data: any): Training {
    return {
      id: data.id,
      title: data.title,
      description: data.description,
      category: data.category,
      content: data.content,
      durationMinutes: data.duration_minutes,
      isActive: data.is_active,
      createdBy: data.created_by,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  private mapToTrainingCompletion(data: any): TrainingCompletion {
    return {
      id: data.id,
      trainingId: data.training_id,
      userId: data.user_id,
      startedAt: data.started_at,
      completedAt: data.completed_at,
      timeSpentSeconds: data.time_spent_seconds,
      createdAt: data.created_at,
    };
  }

  private mapToTrainingSignature(data: any): TrainingSignature {
    return {
      id: data.id,
      trainingCompletionId: data.training_completion_id,
      signaturePath: data.signature_path,
      fullName: data.full_name,
      timestamp: data.timestamp,
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }

  private mapToTrainingAttachment(data: any): TrainingAttachment {
    return {
      id: data.id,
      trainingId: data.training_id,
      filename: data.filename,
      mimeType: data.mime_type,
      storagePath: data.storage_path,
      createdAt: data.created_at,
    };
  }

  async addTrainingAttachment(
    trainingId: string,
    file: File | { uri: string; name: string; type: string }
  ): Promise<TrainingAttachment> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    const filename = 'name' in file ? file.name : file.uri.split('/').pop() || 'unknown';
    const mimeType = 'type' in file ? file.type : 'application/pdf';
    const fileUri = 'uri' in file ? file.uri : '';

    // Generate unique filename
    const timestamp = Date.now();
    const uniqueFilename = `${timestamp}_${filename}`;
    const BUCKET_NAME = 'documents';

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
        throw new Error(`Failed to upload file to storage: ${uploadError.message || 'Unknown error'}`);
      }

      const storagePath = `${BUCKET_NAME}/${uniqueFilename}`;

      // Create attachment record
      const { data: attachmentData, error: attachmentError } = await supabase
        .from('training_attachments')
        .insert({
          training_id: trainingId,
          filename,
          mime_type: mimeType,
          storage_path: storagePath,
        })
        .select()
        .single();

      if (attachmentError) {
        // Clean up uploaded file if attachment creation fails
        await supabase.storage.from(BUCKET_NAME).remove([uniqueFilename]);
        console.error('Error creating attachment record:', attachmentError);
        throw new Error(`Failed to create attachment record: ${attachmentError.message || 'Unknown error'}`);
      }

      return this.mapToTrainingAttachment(attachmentData);
    } catch (error: any) {
      console.error('Error adding training attachment:', error);
      throw new Error(error?.message || 'Failed to add training attachment');
    }
  }

  async deleteTrainingAttachment(attachmentId: string): Promise<void> {
    // Get attachment to get storage path
    const { data: attachment, error: fetchError } = await supabase
      .from('training_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .single();

    if (fetchError || !attachment) {
      throw new Error('Attachment not found');
    }

    // Delete from storage
    const filename = attachment.storage_path.includes('/')
      ? attachment.storage_path.split('/').pop()
      : attachment.storage_path.replace('documents/', '');
    
    await supabase.storage.from('documents').remove([filename || attachment.storage_path]);

    // Delete attachment record
    const { error } = await supabase
      .from('training_attachments')
      .delete()
      .eq('id', attachmentId);

    if (error) {
      console.error('Error deleting attachment:', error);
      throw new Error('Failed to delete attachment');
    }
  }

  async getTrainingAttachmentUrl(attachmentId: string): Promise<string> {
    const { data: attachment, error } = await supabase
      .from('training_attachments')
      .select('storage_path')
      .eq('id', attachmentId)
      .single();

    if (error || !attachment) {
      throw new Error('Attachment not found');
    }

    const filename = attachment.storage_path.includes('/')
      ? attachment.storage_path.split('/').pop()
      : attachment.storage_path.replace('documents/', '');

    // Get signed URL from Supabase Storage (valid for 1 hour)
    const { data, error: urlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(filename || attachment.storage_path, 3600);

    if (urlError) {
      console.error('Error getting attachment URL:', urlError);
      return attachment.storage_path;
    }

    return data.signedUrl;
  }
}
