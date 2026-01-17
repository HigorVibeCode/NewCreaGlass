import { ProductionRepository } from '../../services/repositories/interfaces';
import { Production, ProductionStatus, ProductionStatusHistory, ProductionItem, ProductionAttachment } from '../../types';
import { supabase } from '../../services/supabase';

export class SupabaseProductionRepository implements ProductionRepository {
  async getAllProductions(status?: ProductionStatus): Promise<Production[]> {
    let query = supabase
      .from('productions')
      .select('*');

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching productions:', error);
      throw new Error('Failed to fetch productions');
    }

    // Load related data for each production
    const productions = await Promise.all(
      (data || []).map(async (prod) => this.loadProductionWithRelations(prod))
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

    return this.loadProductionWithRelations(data);
  }

  async createProduction(
    production: Omit<Production, 'id' | 'createdAt'>
  ): Promise<Production> {
    // Get current authenticated user from Supabase session
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      throw new Error('User not authenticated');
    }

    // Create production record
    // Use auth.uid() instead of production.createdBy to ensure RLS policy passes
    const { data: prodData, error: prodError } = await supabase
      .from('productions')
      .insert({
        client_name: production.clientName,
        order_number: production.orderNumber,
        order_type: production.orderType,
        due_date: production.dueDate,
        status: production.status,
        created_by: authUser.id, // Use auth.uid() from Supabase session
      })
      .select()
      .single();

    if (prodError) {
      console.error('Error creating production:', prodError);
      console.error('Error details:', JSON.stringify(prodError, null, 2));
      console.error('Production data:', JSON.stringify(production, null, 2));
      const errorMessage = prodError.message || 'Failed to create production';
      throw new Error(`Failed to create production: ${errorMessage}`);
    }

    // Create production items
    if (production.items && production.items.length > 0) {
      const itemsToInsert = production.items.map(item => ({
        production_id: prodData.id,
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
        // Clean up production if items creation fails
        await supabase.from('productions').delete().eq('id', prodData.id);
        console.error('Error creating production items:', itemsError);
        console.error('Error details:', JSON.stringify(itemsError, null, 2));
        console.error('Items to insert:', JSON.stringify(itemsToInsert, null, 2));
        const errorMessage = itemsError.message || 'Failed to create production items';
        throw new Error(`Failed to create production items: ${errorMessage}`);
      }
    }

    // Create production attachments
    if (production.attachments && production.attachments.length > 0) {
      const attachmentsToInsert = production.attachments.map(att => ({
        production_id: prodData.id,
        filename: att.filename,
        mime_type: att.mimeType,
        storage_path: att.storagePath,
      }));

      const { error: attError } = await supabase
        .from('production_attachments')
        .insert(attachmentsToInsert);

      if (attError) {
        console.error('Error creating production attachments:', attError);
        // Don't fail, attachments are optional
      }
    }

    return this.loadProductionWithRelations(prodData);
  }

  async updateProduction(
    productionId: string,
    updates: Partial<Production>,
    changedBy?: string
  ): Promise<Production> {
    const currentProduction = await this.getProductionById(productionId);
    if (!currentProduction) {
      throw new Error('Production not found');
    }

    const previousStatus = currentProduction.status;

    // Update production record
    const updateData: any = {};
    if (updates.clientName !== undefined) updateData.client_name = updates.clientName;
    if (updates.orderNumber !== undefined) updateData.order_number = updates.orderNumber;
    if (updates.orderType !== undefined) updateData.order_type = updates.orderType;
    if (updates.dueDate !== undefined) updateData.due_date = updates.dueDate;
    if (updates.status !== undefined) updateData.status = updates.status;

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

    // Update status history if status changed
    if (updates.status && updates.status !== previousStatus && changedBy) {
      await supabase
        .from('production_status_history')
        .insert({
          production_id: productionId,
          previous_status: previousStatus,
          new_status: updates.status,
          changed_by: changedBy,
        });

      // Create notification when status changes from "not_authorized" to "authorized"
      if (previousStatus === 'not_authorized' && updates.status === 'authorized') {
        try {
          const { repos } = await import('../../services/container');
          await repos.notificationsRepo.createNotification({
            type: 'production.authorized',
            payloadJson: {
              productionId: productionId,
              orderNumber: currentProduction.orderNumber,
              clientName: currentProduction.clientName,
              orderType: currentProduction.orderType,
            },
            createdBySystem: true,
          });
        } catch (notificationError) {
          // Log error but don't fail the status update
          console.warn('Failed to create notification for production status change:', notificationError);
        }
      }
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

    // Update attachments if provided
    if (updates.attachments !== undefined) {
      // Delete existing attachments
      await supabase
        .from('production_attachments')
        .delete()
        .eq('production_id', productionId);

      // Insert new attachments
      if (updates.attachments.length > 0) {
        const attachmentsToInsert = updates.attachments.map(att => ({
          production_id: productionId,
          filename: att.filename,
          mime_type: att.mimeType,
          storage_path: att.storagePath,
        }));

        await supabase
          .from('production_attachments')
          .insert(attachmentsToInsert);
      }
    }

    return this.loadProductionWithRelations(data);
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
      console.error('Error fetching production status history:', error);
      throw new Error('Failed to fetch production status history');
    }

    return (data || []).map(this.mapToStatusHistory);
  }

  private async loadProductionWithRelations(prodData: any): Promise<Production> {
    // Load items
    const { data: items } = await supabase
      .from('production_items')
      .select('*')
      .eq('production_id', prodData.id);

    // Load attachments
    const { data: attachments } = await supabase
      .from('production_attachments')
      .select('*')
      .eq('production_id', prodData.id);

    return {
      id: prodData.id,
      clientName: prodData.client_name,
      orderNumber: prodData.order_number,
      orderType: prodData.order_type,
      dueDate: prodData.due_date,
      status: prodData.status as ProductionStatus,
      items: (items || []).map(this.mapToItem),
      attachments: (attachments || []).map(this.mapToAttachment),
      createdAt: prodData.created_at,
      createdBy: prodData.created_by,
    };
  }

  private mapToItem(data: any): ProductionItem {
    return {
      id: data.id,
      glassId: data.glass_id,
      glassType: data.glass_type,
      quantity: data.quantity,
      areaM2: parseFloat(data.area_m2),
      structureType: data.structure_type,
      paintType: data.paint_type,
    };
  }

  private mapToAttachment(data: any): ProductionAttachment {
    return {
      id: data.id,
      filename: data.filename,
      mimeType: data.mime_type,
      storagePath: data.storage_path,
      createdAt: data.created_at,
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
