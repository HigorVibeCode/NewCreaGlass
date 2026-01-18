-- Create work_order_signatures table for digital signatures
-- Stores signature image, full name, timestamp, geolocation, and optional PIN hash

CREATE TABLE IF NOT EXISTS work_order_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  signature_path TEXT NOT NULL, -- Storage path to signature image
  full_name VARCHAR(255) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  pin_hash TEXT, -- Hashed PIN if PIN was used for confirmation (optional)
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_order_signatures_work_order_id ON work_order_signatures(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_signatures_created_by ON work_order_signatures(created_by);
CREATE INDEX IF NOT EXISTS idx_work_order_signatures_timestamp ON work_order_signatures(timestamp);

-- Unique constraint: One signature per work order
CREATE UNIQUE INDEX IF NOT EXISTS idx_work_order_signatures_unique_work_order ON work_order_signatures(work_order_id);

-- Enable RLS
ALTER TABLE work_order_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view signatures for work orders they can view
CREATE POLICY "Users can view work order signatures"
  ON work_order_signatures
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
    -- Users can view signatures for work orders they can view
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_signatures.work_order_id
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

-- RLS Policy: Users can insert signatures with workOrders.signature permission
CREATE POLICY "Users can insert work order signatures"
  ON work_order_signatures
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
    -- Users with workOrders.signature permission can insert
    (
      EXISTS (
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = auth.uid()
        AND p.key = 'workOrders.signature'
      )
      AND created_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM work_orders wo
        WHERE wo.id = work_order_signatures.work_order_id
        AND wo.is_locked = false -- Can only add signature if work order is not locked
        AND (
          wo.responsible = auth.uid()
          OR auth.uid() = ANY(wo.team_members)
        )
      )
      -- Ensure only one signature per work order
      AND NOT EXISTS (
        SELECT 1 FROM work_order_signatures wos
        WHERE wos.work_order_id = work_order_signatures.work_order_id
      )
    )
  );

-- RLS Policy: Signatures cannot be updated (immutable after creation)
-- Only Master users can delete signatures (for corrections)
CREATE POLICY "Only master users can delete work order signatures"
  ON work_order_signatures
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
  );
