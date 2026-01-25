import { WorkOrdersRepository } from '../../services/repositories/interfaces';
import {
  WorkOrder,
  WorkOrderStatus,
  CheckIn,
  TimeStatus,
  ServiceLog,
  Evidence,
  ChecklistItem,
  Signature,
} from '../../types';
import { supabase } from '../../services/supabase';

export class SupabaseWorkOrdersRepository implements WorkOrdersRepository {
  async getAllWorkOrders(status?: WorkOrderStatus): Promise<WorkOrder[]> {
    let query = supabase.from('work_orders').select('*');

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching work orders:', error);
      throw new Error('Failed to fetch work orders');
    }

    // Load related data for each work order
    const workOrders = await Promise.all(
      (data || []).map(async (wo) => this.loadWorkOrderWithRelations(wo))
    );

    return workOrders;
  }

  async getWorkOrderById(workOrderId: string): Promise<WorkOrder | null> {
    const { data, error } = await supabase
      .from('work_orders')
      .select('*')
      .eq('id', workOrderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching work order:', error);
      throw new Error('Failed to fetch work order');
    }

    if (!data) return null;

    return this.loadWorkOrderWithRelations(data);
  }

  async createWorkOrder(
    workOrder: Omit<WorkOrder, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<WorkOrder> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    const { data: woData, error: woError } = await supabase
      .from('work_orders')
      .insert({
        client_name: workOrder.clientName,
        client_address: workOrder.clientAddress,
        client_contact: workOrder.clientContact,
        service_type: workOrder.serviceType,
        scheduled_date: workOrder.scheduledDate,
        scheduled_time: workOrder.scheduledTime,
        status: workOrder.status || 'planned',
        planned_checklist: workOrder.plannedChecklist || [],
        planned_materials: workOrder.plannedMaterials || [],
        internal_notes: workOrder.internalNotes || null,
        team_members: workOrder.teamMembers || [],
        responsible: workOrder.responsible,
        is_locked: workOrder.isLocked || false,
        created_by: authUser.id,
      })
      .select()
      .single();

    if (woError) {
      console.error('Error creating work order:', woError);
      throw new Error(`Failed to create work order: ${woError.message}`);
    }

    // Create planned checklist items if any
    if (workOrder.checklistItems && workOrder.checklistItems.length > 0) {
      const checklistItems = workOrder.checklistItems.filter((item) => item.type === 'planned');
      if (checklistItems.length > 0) {
        const itemsToInsert = checklistItems.map((item) => ({
          work_order_id: woData.id,
          type: item.type,
          title: item.title,
          description: item.description || null,
          completed: item.completed || false,
        }));

        const { error: checklistError } = await supabase
          .from('work_order_checklist_items')
          .insert(itemsToInsert);

        if (checklistError) {
          console.error('Error creating checklist items:', checklistError);
        }
      }
    }

    const createdWorkOrder = await this.loadWorkOrderWithRelations(woData);

    // Create notification for new work order
    try {
      const { repos } = await import('../../services/container');
      const payload = {
        workOrderId: createdWorkOrder.id,
        clientName: createdWorkOrder.clientName,
        serviceType: createdWorkOrder.serviceType,
        scheduledDate: createdWorkOrder.scheduledDate,
        scheduledTime: createdWorkOrder.scheduledTime,
      };
      
      if (__DEV__) {
        console.log('[SupabaseWorkOrdersRepository] Creating workOrder.created notification with payload:', {
          scheduledDate: payload.scheduledDate,
          scheduledTime: payload.scheduledTime,
          scheduledDateType: typeof payload.scheduledDate,
          scheduledTimeType: typeof payload.scheduledTime,
          fullPayload: payload,
        });
      }
      
      await repos.notificationsRepo.createNotification({
        type: 'workOrder.created',
        payloadJson: payload,
        createdBySystem: true,
        targetUserId: null, // Global notification
      });
      console.log('[SupabaseWorkOrdersRepository] Notification created for new work order');
    } catch (error) {
      console.error('[SupabaseWorkOrdersRepository] Error creating notification:', error);
      // Don't fail work order creation if notification fails
    }

    return createdWorkOrder;
  }

  async updateWorkOrder(workOrderId: string, updates: Partial<WorkOrder>): Promise<WorkOrder> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    const updateData: any = {};
    if (updates.clientName !== undefined) updateData.client_name = updates.clientName;
    if (updates.clientAddress !== undefined) updateData.client_address = updates.clientAddress;
    if (updates.clientContact !== undefined) updateData.client_contact = updates.clientContact;
    if (updates.serviceType !== undefined) updateData.service_type = updates.serviceType;
    if (updates.scheduledDate !== undefined) updateData.scheduled_date = updates.scheduledDate;
    if (updates.scheduledTime !== undefined) updateData.scheduled_time = updates.scheduledTime;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.plannedChecklist !== undefined) updateData.planned_checklist = updates.plannedChecklist;
    if (updates.plannedMaterials !== undefined) updateData.planned_materials = updates.plannedMaterials;
    if (updates.internalNotes !== undefined) updateData.internal_notes = updates.internalNotes;
    if (updates.teamMembers !== undefined) updateData.team_members = updates.teamMembers;
    if (updates.responsible !== undefined) updateData.responsible = updates.responsible;
    if (updates.isLocked !== undefined) updateData.is_locked = updates.isLocked;

    const { data, error } = await supabase
      .from('work_orders')
      .update(updateData)
      .eq('id', workOrderId)
      .select()
      .single();

    if (error) {
      console.error('Error updating work order:', error);
      throw new Error('Failed to update work order');
    }

    return this.loadWorkOrderWithRelations(data);
  }

  async deleteWorkOrder(workOrderId: string): Promise<void> {
    const { error } = await supabase.from('work_orders').delete().eq('id', workOrderId);

    if (error) {
      console.error('Error deleting work order:', error);
      throw new Error('Failed to delete work order');
    }
  }

  // Check-in methods
  async createCheckIn(
    workOrderId: string,
    checkIn: Omit<CheckIn, 'id' | 'workOrderId' | 'createdAt'>
  ): Promise<CheckIn> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('work_order_checkins')
      .insert({
        work_order_id: workOrderId,
        timestamp: checkIn.timestamp,
        latitude: checkIn.latitude,
        longitude: checkIn.longitude,
        tolerance_radius: checkIn.toleranceRadius,
        photo_path: checkIn.photoPath || null,
        performed_by: checkIn.performedBy,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating check-in:', error);
      throw new Error(`Failed to create check-in: ${error.message}`);
    }

    return this.mapToCheckIn(data);
  }

  async getCheckIn(workOrderId: string): Promise<CheckIn | null> {
    const { data, error } = await supabase
      .from('work_order_checkins')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching check-in:', error);
      throw new Error('Failed to fetch check-in');
    }

    return data ? this.mapToCheckIn(data) : null;
  }

  // Time Status methods
  async createTimeStatus(
    workOrderId: string,
    timeStatus: Omit<TimeStatus, 'id' | 'workOrderId' | 'createdAt'>
  ): Promise<TimeStatus> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    if (timeStatus.status === 'PAUSADO' && !timeStatus.pauseReason) {
      throw new Error('Pause reason is required when status is PAUSADO');
    }

    const { data, error } = await supabase
      .from('work_order_time_statuses')
      .insert({
        work_order_id: workOrderId,
        status: timeStatus.status,
        pause_reason: timeStatus.pauseReason || null,
        start_time: timeStatus.startTime,
        end_time: timeStatus.endTime || null,
        total_duration: timeStatus.totalDuration || 0,
        created_by: timeStatus.createdBy,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating time status:', error);
      throw new Error(`Failed to create time status: ${error.message}`);
    }

    return this.mapToTimeStatus(data);
  }

  async updateTimeStatus(timeStatusId: string, updates: Partial<TimeStatus>): Promise<TimeStatus> {
    const updateData: any = {};
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.pauseReason !== undefined) updateData.pause_reason = updates.pauseReason;
    if (updates.startTime !== undefined) updateData.start_time = updates.startTime;
    if (updates.endTime !== undefined) updateData.end_time = updates.endTime;
    if (updates.totalDuration !== undefined) updateData.total_duration = updates.totalDuration;

    const { data, error } = await supabase
      .from('work_order_time_statuses')
      .update(updateData)
      .eq('id', timeStatusId)
      .select()
      .single();

    if (error) {
      console.error('Error updating time status:', error);
      throw new Error('Failed to update time status');
    }

    return this.mapToTimeStatus(data);
  }

  async getTimeStatuses(workOrderId: string): Promise<TimeStatus[]> {
    const { data, error } = await supabase
      .from('work_order_time_statuses')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching time statuses:', error);
      throw new Error('Failed to fetch time statuses');
    }

    return (data || []).map((ts) => this.mapToTimeStatus(ts));
  }

  async getCurrentTimeStatus(workOrderId: string): Promise<TimeStatus | null> {
    const { data, error } = await supabase
      .from('work_order_time_statuses')
      .select('*')
      .eq('work_order_id', workOrderId)
      .is('end_time', null)
      .order('start_time', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching current time status:', error);
      throw new Error('Failed to fetch current time status');
    }

    return data ? this.mapToTimeStatus(data) : null;
  }

  // Service Logs methods
  async createServiceLog(
    workOrderId: string,
    log: Omit<ServiceLog, 'id' | 'workOrderId' | 'createdAt'>
  ): Promise<ServiceLog> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('work_order_service_logs')
      .insert({
        work_order_id: workOrderId,
        type: log.type,
        text: log.text,
        author: log.author,
        timestamp: log.timestamp,
        photo_path: log.photoPath || null,
        video_path: log.videoPath || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating service log:', error);
      throw new Error(`Failed to create service log: ${error.message}`);
    }

    return this.mapToServiceLog(data);
  }

  async getServiceLogs(workOrderId: string): Promise<ServiceLog[]> {
    const { data, error } = await supabase
      .from('work_order_service_logs')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching service logs:', error);
      throw new Error('Failed to fetch service logs');
    }

    return (data || []).map((log) => this.mapToServiceLog(log));
  }

  // Evidences methods
  async createEvidence(
    workOrderId: string,
    evidence: Omit<Evidence, 'id' | 'workOrderId' | 'createdAt'>
  ): Promise<Evidence> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('work_order_evidences')
      .insert({
        work_order_id: workOrderId,
        type: evidence.type,
        photo_path: evidence.photoPath,
        video_path: evidence.videoPath || null,
        internal_notes: evidence.internalNotes || null,
        client_notes: evidence.clientNotes || null,
        created_by: evidence.createdBy,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating evidence:', error);
      throw new Error(`Failed to create evidence: ${error.message}`);
    }

    return this.mapToEvidence(data);
  }

  async getEvidences(workOrderId: string): Promise<Evidence[]> {
    const { data, error } = await supabase
      .from('work_order_evidences')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('type', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching evidences:', error);
      throw new Error('Failed to fetch evidences');
    }

    return (data || []).map((ev) => this.mapToEvidence(ev));
  }

  // Checklist Items methods
  async createChecklistItem(
    workOrderId: string,
    item: Omit<ChecklistItem, 'id' | 'workOrderId' | 'createdAt'>
  ): Promise<ChecklistItem> {
    const { data, error } = await supabase
      .from('work_order_checklist_items')
      .insert({
        work_order_id: workOrderId,
        type: item.type,
        title: item.title,
        description: item.description || null,
        completed: item.completed || false,
        completed_at: item.completedAt || null,
        completed_by: item.completedBy || null,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating checklist item:', error);
      throw new Error(`Failed to create checklist item: ${error.message}`);
    }

    return this.mapToChecklistItem(data);
  }

  async updateChecklistItem(itemId: string, updates: Partial<ChecklistItem>): Promise<ChecklistItem> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    const updateData: any = {};
    if (updates.title !== undefined) updateData.title = updates.title;
    if (updates.description !== undefined) updateData.description = updates.description;
    if (updates.completed !== undefined) {
      updateData.completed = updates.completed;
      if (updates.completed) {
        updateData.completed_at = new Date().toISOString();
        updateData.completed_by = authUser.id;
      } else {
        updateData.completed_at = null;
        updateData.completed_by = null;
      }
    }
    if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt;
    if (updates.completedBy !== undefined) updateData.completed_by = updates.completedBy;

    const { data, error } = await supabase
      .from('work_order_checklist_items')
      .update(updateData)
      .eq('id', itemId)
      .select()
      .single();

    if (error) {
      console.error('Error updating checklist item:', error);
      throw new Error('Failed to update checklist item');
    }

    return this.mapToChecklistItem(data);
  }

  async getChecklistItems(workOrderId: string): Promise<ChecklistItem[]> {
    const { data, error } = await supabase
      .from('work_order_checklist_items')
      .select('*')
      .eq('work_order_id', workOrderId)
      .order('type', { ascending: true })
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching checklist items:', error);
      throw new Error('Failed to fetch checklist items');
    }

    return (data || []).map((item) => this.mapToChecklistItem(item));
  }

  // Signature methods
  async createSignature(
    workOrderId: string,
    signature: Omit<Signature, 'id' | 'workOrderId' | 'createdAt'>
  ): Promise<Signature> {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('work_order_signatures')
      .insert({
        work_order_id: workOrderId,
        signature_path: signature.signaturePath,
        full_name: signature.fullName,
        timestamp: signature.timestamp,
        latitude: signature.latitude,
        longitude: signature.longitude,
        pin_hash: signature.pinHash || null,
        created_by: signature.createdBy,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating signature:', error);
      throw new Error(`Failed to create signature: ${error.message}`);
    }

    return this.mapToSignature(data);
  }

  async getSignature(workOrderId: string): Promise<Signature | null> {
    const { data, error } = await supabase
      .from('work_order_signatures')
      .select('*')
      .eq('work_order_id', workOrderId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      console.error('Error fetching signature:', error);
      throw new Error('Failed to fetch signature');
    }

    return data ? this.mapToSignature(data) : null;
  }

  // Finalization
  async finalizeWorkOrder(workOrderId: string): Promise<WorkOrder> {
    // Lock the work order and update status to completed
    const { data, error } = await supabase
      .from('work_orders')
      .update({
        is_locked: true,
        status: 'completed',
      })
      .eq('id', workOrderId)
      .select()
      .single();

    if (error) {
      console.error('Error finalizing work order:', error);
      throw new Error('Failed to finalize work order');
    }

    return this.loadWorkOrderWithRelations(data);
  }

  // Private helper methods
  private async loadWorkOrderWithRelations(woData: any): Promise<WorkOrder> {
    const workOrderId = woData.id;

    // Load check-in
    const checkIn = await this.getCheckIn(workOrderId);

    // Load time statuses
    const timeStatuses = await this.getTimeStatuses(workOrderId);

    // Load service logs
    const serviceLogs = await this.getServiceLogs(workOrderId);

    // Load evidences
    const evidences = await this.getEvidences(workOrderId);

    // Load checklist items
    const checklistItems = await this.getChecklistItems(workOrderId);

    // Load signature
    const signature = await this.getSignature(workOrderId);

    return this.mapToWorkOrder({
      ...woData,
      checkIn,
      timeStatuses,
      serviceLogs,
      evidences,
      checklistItems,
      signature,
    });
  }

  private mapToWorkOrder(data: any): WorkOrder {
    return {
      id: data.id,
      clientName: data.client_name,
      clientAddress: data.client_address,
      clientContact: data.client_contact,
      serviceType: data.service_type,
      scheduledDate: data.scheduled_date,
      scheduledTime: data.scheduled_time,
      status: data.status,
      plannedChecklist: data.planned_checklist || [],
      plannedMaterials: data.planned_materials || [],
      internalNotes: data.internal_notes || undefined,
      teamMembers: data.team_members || [],
      responsible: data.responsible,
      isLocked: data.is_locked || false,
      checkIn: data.checkIn || undefined,
      timeStatuses: data.timeStatuses || [],
      serviceLogs: data.serviceLogs || [],
      evidences: data.evidences || [],
      checklistItems: data.checklistItems || [],
      signature: data.signature || undefined,
      createdAt: data.created_at,
      createdBy: data.created_by,
      updatedAt: data.updated_at || undefined,
    };
  }

  private mapToCheckIn(data: any): CheckIn {
    return {
      id: data.id,
      workOrderId: data.work_order_id,
      timestamp: data.timestamp,
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      toleranceRadius: data.tolerance_radius,
      photoPath: data.photo_path || undefined,
      performedBy: data.performed_by,
      createdAt: data.created_at,
    };
  }

  private mapToTimeStatus(data: any): TimeStatus {
    return {
      id: data.id,
      workOrderId: data.work_order_id,
      status: data.status,
      pauseReason: data.pause_reason || undefined,
      startTime: data.start_time,
      endTime: data.end_time || undefined,
      totalDuration: data.total_duration || 0,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }

  private mapToServiceLog(data: any): ServiceLog {
    return {
      id: data.id,
      workOrderId: data.work_order_id,
      type: data.type,
      text: data.text,
      author: data.author,
      timestamp: data.timestamp,
      photoPath: data.photo_path || undefined,
      videoPath: data.video_path || undefined,
      createdAt: data.created_at,
    };
  }

  private mapToEvidence(data: any): Evidence {
    return {
      id: data.id,
      workOrderId: data.work_order_id,
      type: data.type,
      photoPath: data.photo_path,
      videoPath: data.video_path || undefined,
      internalNotes: data.internal_notes || undefined,
      clientNotes: data.client_notes || undefined,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }

  private mapToChecklistItem(data: any): ChecklistItem {
    return {
      id: data.id,
      workOrderId: data.work_order_id,
      type: data.type,
      title: data.title,
      description: data.description || undefined,
      completed: data.completed || false,
      completedAt: data.completed_at || undefined,
      completedBy: data.completed_by || undefined,
      createdAt: data.created_at,
    };
  }

  private mapToSignature(data: any): Signature {
    return {
      id: data.id,
      workOrderId: data.work_order_id,
      signaturePath: data.signature_path,
      fullName: data.full_name,
      timestamp: data.timestamp,
      latitude: parseFloat(data.latitude),
      longitude: parseFloat(data.longitude),
      pinHash: data.pin_hash || undefined,
      createdBy: data.created_by,
      createdAt: data.created_at,
    };
  }
}
