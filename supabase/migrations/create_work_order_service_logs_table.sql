-- Create work_order_service_logs table for service diary/logs
-- Stores adjustments, problems, materials used, and technical recommendations

CREATE TABLE IF NOT EXISTS work_order_service_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('ajuste', 'problema', 'material', 'recomendacao')),
  text TEXT NOT NULL,
  author UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  photo_path TEXT, -- Storage path for optional photo
  video_path TEXT, -- Storage path for optional video
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_order_service_logs_work_order_id ON work_order_service_logs(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_service_logs_type ON work_order_service_logs(type);
CREATE INDEX IF NOT EXISTS idx_work_order_service_logs_author ON work_order_service_logs(author);
CREATE INDEX IF NOT EXISTS idx_work_order_service_logs_timestamp ON work_order_service_logs(timestamp);

-- Enable RLS
ALTER TABLE work_order_service_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view service logs for work orders they can view
CREATE POLICY "Users can view work order service logs"
  ON work_order_service_logs
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
    -- Users can view service logs for work orders they can view
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_service_logs.work_order_id
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

-- RLS Policy: Users can insert service logs with workOrders.log permission
CREATE POLICY "Users can insert work order service logs"
  ON work_order_service_logs
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
    -- Users with workOrders.log permission can insert
    (
      EXISTS (
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = auth.uid()
        AND p.key = 'workOrders.log'
      )
      AND author = auth.uid()
      AND EXISTS (
        SELECT 1 FROM work_orders wo
        WHERE wo.id = work_order_service_logs.work_order_id
        AND (wo.responsible = auth.uid() OR auth.uid() = ANY(wo.team_members))
      )
    )
  );

-- RLS Policy: Users can update their own service logs
CREATE POLICY "Users can update work order service logs"
  ON work_order_service_logs
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
    -- Users can update their own service logs
    author = auth.uid()
  );

-- RLS Policy: Users can delete their own service logs
CREATE POLICY "Users can delete work order service logs"
  ON work_order_service_logs
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
    -- Users can delete their own service logs
    author = auth.uid()
  );
