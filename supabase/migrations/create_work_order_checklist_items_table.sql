-- Create work_order_checklist_items table for checklist items
-- Supports both planned checklist items and execution (client) checklist items

CREATE TABLE IF NOT EXISTS work_order_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('planned', 'execution')),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_order_checklist_items_work_order_id ON work_order_checklist_items(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_checklist_items_type ON work_order_checklist_items(type);
CREATE INDEX IF NOT EXISTS idx_work_order_checklist_items_completed ON work_order_checklist_items(completed);
CREATE INDEX IF NOT EXISTS idx_work_order_checklist_items_completed_by ON work_order_checklist_items(completed_by);

-- Enable RLS
ALTER TABLE work_order_checklist_items ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view checklist items for work orders they can view
CREATE POLICY "Users can view work order checklist items"
  ON work_order_checklist_items
  FOR SELECT
  USING (
    -- Master users can view all
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
    OR
    -- Users can view checklist items for work orders they can view
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_checklist_items.work_order_id
      AND (
        wo.created_by = auth.uid()
        OR wo.responsible = auth.uid()
        OR auth.uid() = ANY(wo.team_members)
        OR EXISTS (
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = auth.uid()
          AND p.key = 'workOrders.view'
        )
      )
    )
  );

-- RLS Policy: Users can insert checklist items
CREATE POLICY "Users can insert work order checklist items"
  ON work_order_checklist_items
  FOR INSERT
  WITH CHECK (
    -- Master users can insert
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
    OR
    -- Users with workOrders.create or workOrders.update permission can insert
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key IN ('workOrders.create', 'workOrders.update')
      AND EXISTS (
        SELECT 1 FROM work_orders wo
        WHERE wo.id = work_order_checklist_items.work_order_id
        AND (
          wo.created_by = auth.uid()
          OR wo.responsible = auth.uid()
          OR auth.uid() = ANY(wo.team_members)
        )
      )
    )
  );

-- RLS Policy: Users can update checklist items
CREATE POLICY "Users can update work order checklist items"
  ON work_order_checklist_items
  FOR UPDATE
  USING (
    -- Master users can update
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
    OR
    -- Users with workOrders.update permission can update
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'workOrders.update'
      AND EXISTS (
        SELECT 1 FROM work_orders wo
        WHERE wo.id = work_order_checklist_items.work_order_id
        AND (
          wo.created_by = auth.uid()
          OR wo.responsible = auth.uid()
          OR auth.uid() = ANY(wo.team_members)
        )
      )
    )
  )
  WITH CHECK (
    -- If marking as completed, set completed_by and completed_at
    (completed = true AND completed_by = auth.uid() AND completed_at IS NOT NULL)
    OR
    (completed = false AND completed_by IS NULL AND completed_at IS NULL)
  );

-- RLS Policy: Users can delete checklist items
CREATE POLICY "Users can delete work order checklist items"
  ON work_order_checklist_items
  FOR DELETE
  USING (
    -- Master users can delete
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
    OR
    -- Users with workOrders.update permission can delete
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'workOrders.update'
      AND EXISTS (
        SELECT 1 FROM work_orders wo
        WHERE wo.id = work_order_checklist_items.work_order_id
        AND (
          wo.created_by = auth.uid()
          OR wo.responsible = auth.uid()
          OR auth.uid() = ANY(wo.team_members)
        )
      )
    )
  );
