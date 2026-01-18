-- Create work_order_time_statuses table for time control tracking
-- Tracks different time statuses: EM_ATENDIMENTO, PAUSADO, DESLOCAMENTO

CREATE TABLE IF NOT EXISTS work_order_time_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  status VARCHAR(50) NOT NULL CHECK (status IN ('EM_ATENDIMENTO', 'PAUSADO', 'DESLOCAMENTO')),
  pause_reason TEXT, -- Required if status is PAUSADO
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time TIMESTAMPTZ, -- Nullable, set when status changes
  total_duration INTEGER DEFAULT 0, -- in seconds
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_order_time_statuses_work_order_id ON work_order_time_statuses(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_time_statuses_status ON work_order_time_statuses(status);
CREATE INDEX IF NOT EXISTS idx_work_order_time_statuses_start_time ON work_order_time_statuses(start_time);
CREATE INDEX IF NOT EXISTS idx_work_order_time_statuses_created_by ON work_order_time_statuses(created_by);

-- Enable RLS
ALTER TABLE work_order_time_statuses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view time statuses for work orders they can view
CREATE POLICY "Users can view work order time statuses"
  ON work_order_time_statuses
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
    -- Users can view time statuses for work orders they can view
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_time_statuses.work_order_id
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

-- RLS Policy: Users can insert time statuses with workOrders.timestatus permission
CREATE POLICY "Users can insert work order time statuses"
  ON work_order_time_statuses
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
    -- Users with workOrders.timestatus permission can insert
    (
      EXISTS (
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = auth.uid()
        AND p.key = 'workOrders.timestatus'
      )
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM work_orders wo
        WHERE wo.id = work_order_time_statuses.work_order_id
        AND (wo.responsible = auth.uid() OR auth.uid() = ANY(wo.team_members))
      )
      AND (
        status != 'PAUSADO' OR pause_reason IS NOT NULL
      ) -- Pause reason required if status is PAUSADO
    )
  );

-- RLS Policy: Users can update time statuses (to set end_time)
CREATE POLICY "Users can update work order time statuses"
  ON work_order_time_statuses
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
    -- Users who created the time status can update it
    created_by = auth.uid()
    OR
    -- Users with workOrders.timestatus permission can update
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'workOrders.timestatus'
      AND EXISTS (
        SELECT 1 FROM work_orders wo
        WHERE wo.id = work_order_time_statuses.work_order_id
        AND (wo.responsible = auth.uid() OR auth.uid() = ANY(wo.team_members))
      )
    )
  );
