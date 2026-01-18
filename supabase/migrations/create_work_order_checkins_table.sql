-- Create work_order_checkins table for check-in tracking at service location
-- Stores geolocation, timestamp, and optional photo

CREATE TABLE IF NOT EXISTS work_order_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  tolerance_radius INTEGER NOT NULL DEFAULT 100, -- in meters
  photo_path TEXT, -- Storage path for optional photo
  performed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_work_order_checkins_work_order_id ON work_order_checkins(work_order_id);
CREATE INDEX IF NOT EXISTS idx_work_order_checkins_performed_by ON work_order_checkins(performed_by);
CREATE INDEX IF NOT EXISTS idx_work_order_checkins_timestamp ON work_order_checkins(timestamp);

-- Enable RLS
ALTER TABLE work_order_checkins ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view check-ins for work orders they can view
CREATE POLICY "Users can view work order check-ins"
  ON work_order_checkins
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
    -- Users can view check-ins for work orders they can view
    EXISTS (
      SELECT 1 FROM work_orders wo
      WHERE wo.id = work_order_checkins.work_order_id
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

-- RLS Policy: Users can insert check-ins with workOrders.checkin permission
CREATE POLICY "Users can insert work order check-ins"
  ON work_order_checkins
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
    -- Users with workOrders.checkin permission can insert
    (
      EXISTS (
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = auth.uid()
        AND p.key = 'workOrders.checkin'
      )
      AND performed_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM work_orders wo
        WHERE wo.id = work_order_checkins.work_order_id
        AND (wo.responsible = auth.uid() OR auth.uid() = ANY(wo.team_members))
      )
    )
  );
