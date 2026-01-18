-- Create work_order_evidences table for evidence photos/videos
-- Separates internal notes from client-visible notes

CREATE TABLE IF NOT EXISTS work_order_evidences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('antes', 'durante', 'depois')),
  photo_path TEXT NOT NULL, -- Storage path for photo (required)
  video_path TEXT, -- Storage path for optional video
  internal_notes TEXT, -- Not visible to client
  client_notes TEXT, -- Visible to client
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_order_evidences_work_order_id ON work_order_evidences(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_evidences_type ON work_order_evidences(type);
CREATE INDEX IF NOT EXISTS idx_work_order_evidences_created_by ON work_order_evidences(created_by);
CREATE INDEX IF NOT EXISTS idx_work_order_evidences_created_at ON work_order_evidences(created_at);

-- Enable RLS
ALTER TABLE work_order_evidences ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view evidences for work orders they can view
CREATE POLICY "Users can view work order evidences"
  ON work_order_evidences
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
    -- Users can view evidences for work orders they can view
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_evidences.work_order_id
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

-- RLS Policy: Users can insert evidences with workOrders.evidence permission
CREATE POLICY "Users can insert work order evidences"
  ON work_order_evidences
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
    -- Users with workOrders.evidence permission can insert
    (
      EXISTS (
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = auth.uid()
        AND p.key = 'workOrders.evidence'
      )
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM work_orders wo
        WHERE wo.id = work_order_evidences.work_order_id
        AND (wo.responsible = auth.uid() OR auth.uid() = ANY(wo.team_members))
      )
    )
  );

-- RLS Policy: Users can update their own evidences
CREATE POLICY "Users can update work order evidences"
  ON work_order_evidences
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
    -- Users can update their own evidences
    created_by = auth.uid()
  );

-- RLS Policy: Users can delete their own evidences
CREATE POLICY "Users can delete work order evidences"
  ON work_order_evidences
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
    -- Users can delete their own evidences
    created_by = auth.uid()
  );
