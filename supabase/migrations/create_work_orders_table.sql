-- Create work_orders table for service execution control system
-- This table stores the main Work Order / Service Order information

CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name VARCHAR(255) NOT NULL,
  client_address TEXT NOT NULL,
  client_contact VARCHAR(255) NOT NULL,
  service_type VARCHAR(50) NOT NULL CHECK (service_type IN ('maintenance', 'installation', 'internal', 'external')),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'paused', 'completed', 'cancelled')),
  planned_checklist JSONB DEFAULT '[]'::jsonb, -- Array of {id, title, description, checked}
  planned_materials JSONB DEFAULT '[]'::jsonb, -- Array of {id, name, quantity, unit}
  internal_notes TEXT,
  team_members UUID[] DEFAULT '{}', -- Array of user IDs
  responsible UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  is_locked BOOLEAN DEFAULT false, -- Locked after finalization
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_work_orders_status ON work_orders(status);
CREATE INDEX IF NOT EXISTS idx_work_orders_service_type ON work_orders(service_type);
CREATE INDEX IF NOT EXISTS idx_work_orders_scheduled_date ON work_orders(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_work_orders_responsible ON work_orders(responsible);
CREATE INDEX IF NOT EXISTS idx_work_orders_created_by ON work_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_work_orders_team_members ON work_orders USING GIN(team_members);

-- Enable RLS
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view work orders based on permissions
CREATE POLICY "Users can view work orders"
  ON work_orders
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
    -- Users with workOrders.view permission can view
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'workOrders.view'
    )
    OR
    -- Users can view work orders they created
    created_by = auth.uid()
    OR
    -- Users can view work orders they are responsible for
    responsible = auth.uid()
    OR
    -- Users can view work orders they are team members of
    auth.uid() = ANY(team_members)
  );

-- RLS Policy: Users can insert work orders with workOrders.create permission
CREATE POLICY "Users can insert work orders"
  ON work_orders
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
    -- Users with workOrders.create permission can insert
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'workOrders.create'
    )
    AND created_by = auth.uid()
  );

-- RLS Policy: Users can update work orders (only if not locked)
CREATE POLICY "Users can update work orders"
  ON work_orders
  FOR UPDATE
  USING (
    -- Can't update if locked
    is_locked = false
    AND (
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
      )
      OR
      -- Users can update work orders they created
      created_by = auth.uid()
      OR
      -- Users can update work orders they are responsible for
      responsible = auth.uid()
      OR
      -- Users can update work orders they are team members of
      auth.uid() = ANY(team_members)
    )
  )
  WITH CHECK (
    is_locked = false
  );

-- RLS Policy: Users can delete work orders (only if not locked)
CREATE POLICY "Users can delete work orders"
  ON work_orders
  FOR DELETE
  USING (
    -- Can't delete if locked
    is_locked = false
    AND (
      -- Master users can delete
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.user_type = 'Master'
        AND users.is_active = true
      )
      OR
      -- Users with workOrders.delete permission can delete
      EXISTS (
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = auth.uid()
        AND p.key = 'workOrders.delete'
      )
      OR
      -- Users can delete work orders they created
      created_by = auth.uid()
    )
  );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_orders_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER work_orders_updated_at_trigger
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_updated_at();
