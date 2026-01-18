import { EventsRepository } from '../../services/repositories/interfaces';
import { Event, EventAttachment } from '../../types';
import { supabase } from '../../services/supabase';

export class SupabaseEventsRepository implements EventsRepository {
  async getAllEvents(): Promise<Event[]> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching events:', error);
      throw new Error('Failed to fetch events');
    }

    // Load related data for each event
    const events = await Promise.all(
      (data || []).map(async (eventData) => this.loadEventWithRelations(eventData))
    );

    return events;
  }

  async getEventById(eventId: string): Promise<Event | null> {
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching event:', error);
      throw new Error('Failed to fetch event');
    }

    return data ? this.loadEventWithRelations(data) : null;
  }

  async createEvent(event: Omit<Event, 'id' | 'createdAt'>): Promise<Event> {
    // Get current authenticated user from Supabase session
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    // Insert main event record
    // Convert empty strings to null for optional fields
    const { data: eventData, error: eventError } = await supabase
      .from('events')
      .insert({
        title: event.title,
        type: event.type,
        start_date: event.startDate,
        end_date: event.endDate && event.endDate.trim() ? event.endDate : null,
        start_time: event.startTime,
        end_time: event.endTime && event.endTime.trim() ? event.endTime : null,
        location: event.location,
        people: event.people || '',
        description: event.description || null,
        created_by: authUser.id, // Use auth.uid() from Supabase session
      })
      .select()
      .single();

    if (eventError) {
      console.error('Error creating event:', eventError);
      console.error('Error details:', JSON.stringify(eventError, null, 2));
      const errorMessage = eventError.message || 'Failed to create event';
      throw new Error(`Failed to create event: ${errorMessage}`);
    }

    const eventId = eventData.id;

    // Insert attachments if any
    if (event.attachments && event.attachments.length > 0) {
      const attachmentsToInsert = event.attachments.map((att) => ({
        event_id: eventId,
        filename: att.filename,
        mime_type: att.mimeType,
        storage_path: att.storagePath,
      }));

      const { error: attachmentsError } = await supabase
        .from('event_attachments')
        .insert(attachmentsToInsert);

      if (attachmentsError) {
        console.error('Error creating event attachments:', attachmentsError);
        // Don't fail the whole operation if attachments fail
      }
    }

    // Load the complete event with relations
    return this.loadEventWithRelations(eventData);
  }

  async deleteEvent(eventId: string): Promise<void> {
    // Delete attachments first
    const { error: deleteAttachmentsError } = await supabase
      .from('event_attachments')
      .delete()
      .eq('event_id', eventId);

    if (deleteAttachmentsError) {
      console.error('Error deleting event attachments:', deleteAttachmentsError);
      // Continue with event deletion even if attachments fail
    }

    // Delete event
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', eventId);

    if (error) {
      console.error('Error deleting event:', error);
      throw new Error('Failed to delete event');
    }
  }

  private async loadEventWithRelations(eventData: any): Promise<Event> {
    const eventId = eventData.id;

    // Load attachments
    const { data: attachmentsData, error: attachmentsError } = await supabase
      .from('event_attachments')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false });

    if (attachmentsError) {
      console.error('Error loading event attachments:', attachmentsError);
    }

    const attachments: EventAttachment[] = (attachmentsData || []).map((att: any) => ({
      id: att.id,
      filename: att.filename,
      mimeType: att.mime_type,
      storagePath: att.storage_path,
      createdAt: att.created_at,
    }));

    return this.mapToEvent({
      ...eventData,
      attachments,
    });
  }

  private mapToEvent(data: any): Event {
    return {
      id: data.id,
      title: data.title,
      type: data.type || 'other',
      startDate: data.start_date || '',
      endDate: data.end_date || '',
      startTime: data.start_time || '',
      endTime: data.end_time || '',
      location: data.location || '',
      people: data.people || '',
      attachments: data.attachments || [],
      description: data.description || '',
      createdAt: data.created_at,
      createdBy: data.created_by,
    };
  }
}
