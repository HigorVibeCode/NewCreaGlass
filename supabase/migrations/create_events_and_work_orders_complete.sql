-- ============================================================================
-- MIGRATION COMPLETA: Events e Work Orders (Reports)
-- ============================================================================
-- Este arquivo contém TODAS as migrations necessárias para os sistemas de
-- Events e Work Orders (Reports) em um único arquivo.
--
-- Execute este arquivo completo no SQL Editor do Supabase para criar todas
-- as tabelas, índices, RLS policies e triggers necessários.
--
-- IMPORTANTE: Este arquivo inclui DROP POLICY IF EXISTS antes de cada
-- CREATE POLICY para evitar erros se as policies já existirem.
-- ============================================================================

-- ============================================================================
-- PARTE 1: EVENTS (Sistema de Eventos)
-- ============================================================================

-- Create events table (initial schema)
-- This migration creates the base events table if it doesn't exist
-- Note: This table may have been created earlier, so we check first

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);

-- Enable RLS
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view events based on permissions
DROP POLICY IF EXISTS "Users can view events" ON events;
CREATE POLICY "Users can view events"
  ON events
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
    -- Users with events.view permission can view
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'events.view'
    )
    OR
    -- Users can view events they created
    created_by = auth.uid()
  );

-- RLS Policy: Users can insert events with events.create permission
DROP POLICY IF EXISTS "Users can insert events" ON events;
CREATE POLICY "Users can insert events"
  ON events
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
    -- Users with events.create permission can insert
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'events.create'
    )
    AND created_by = auth.uid()
  );

-- RLS Policy: Users can update events with events.update permission
DROP POLICY IF EXISTS "Users can update events" ON events;
CREATE POLICY "Users can update events"
  ON events
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
    -- Users with events.update permission can update
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'events.update'
    )
    OR
    -- Users can update events they created
    created_by = auth.uid()
  );

-- RLS Policy: Users can delete events with events.delete permission
DROP POLICY IF EXISTS "Users can delete events" ON events;
CREATE POLICY "Users can delete events"
  ON events
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
    -- Users with events.delete permission can delete
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'events.delete'
    )
    OR
    -- Users can delete events they created
    created_by = auth.uid()
  );


-- Update events table to add new fields: type, start_date, end_date, start_time, end_time, location, people
-- This migration adds the fields needed for the complete event management system

-- Add new columns to events table if they don't exist
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS people TEXT DEFAULT '';

-- If people column already exists as UUID[], drop and recreate as TEXT
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' 
    AND column_name = 'people' 
    AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE events DROP COLUMN people;
    ALTER TABLE events ADD COLUMN people TEXT DEFAULT '';
  END IF;
END $$;

-- Create index for type filtering
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(end_date);


-- Create event_attachments table to store attachments (photos/PDFs) for events
-- Similar structure to production_attachments

CREATE TABLE IF NOT EXISTS event_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_event_attachments_event_id ON event_attachments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attachments_created_at ON event_attachments(created_at);

-- Enable RLS
ALTER TABLE event_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view attachments for events they have permission to view
DROP POLICY IF EXISTS "Users can view event attachments" ON event_attachments;
CREATE POLICY "Users can view event attachments"
  ON event_attachments
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
    -- Users with events.view permission can view
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'events.view'
    )
    OR
    -- Users can view attachments for events they created
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_attachments.event_id
      AND events.created_by = auth.uid()
    )
  );

-- RLS Policy: Users can insert attachments for events they created or have events.create permission
DROP POLICY IF EXISTS "Users can insert event attachments" ON event_attachments;
CREATE POLICY "Users can insert event attachments"
  ON event_attachments
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
    -- Users with events.create permission can insert
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'events.create'
      AND EXISTS (
        SELECT 1 FROM events
        WHERE events.id = event_attachments.event_id
        AND events.created_by = auth.uid()
      )
    )
  );

-- RLS Policy: Users can delete attachments for events they created
DROP POLICY IF EXISTS "Users can delete event attachments" ON event_attachments;
CREATE POLICY "Users can delete event attachments"
  ON event_attachments
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
    -- Users can delete attachments for events they created
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_attachments.event_id
      AND events.created_by = auth.uid()
    )
  );


-- ============================================================================
-- PARTE 2: WORK ORDERS (Sistema de Reports / Controle de Serviços)
-- ============================================================================

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
DROP POLICY IF EXISTS "Users can view work orders" ON work_orders;
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
DROP POLICY IF EXISTS "Users can insert work orders" ON work_orders;
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
DROP POLICY IF EXISTS "Users can update work orders" ON work_orders;
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
DROP POLICY IF EXISTS "Users can delete work orders" ON work_orders;
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
DROP TRIGGER IF EXISTS work_orders_updated_at_trigger ON work_orders;
CREATE TRIGGER work_orders_updated_at_trigger
  BEFORE UPDATE ON work_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_work_orders_updated_at();


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
DROP POLICY IF EXISTS "Users can view work order check-ins" ON work_order_checkins;
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
DROP POLICY IF EXISTS "Users can insert work order check-ins" ON work_order_checkins;
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
DROP POLICY IF EXISTS "Users can view work order time statuses" ON work_order_time_statuses;
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
DROP POLICY IF EXISTS "Users can insert work order time statuses" ON work_order_time_statuses;
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
DROP POLICY IF EXISTS "Users can update work order time statuses" ON work_order_time_statuses;
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
DROP POLICY IF EXISTS "Users can view work order service logs" ON work_order_service_logs;
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
DROP POLICY IF EXISTS "Users can insert work order service logs" ON work_order_service_logs;
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
DROP POLICY IF EXISTS "Users can update work order service logs" ON work_order_service_logs;
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
DROP POLICY IF EXISTS "Users can delete work order service logs" ON work_order_service_logs;
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
DROP POLICY IF EXISTS "Users can view work order evidences" ON work_order_evidences;
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
DROP POLICY IF EXISTS "Users can insert work order evidences" ON work_order_evidences;
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
DROP POLICY IF EXISTS "Users can update work order evidences" ON work_order_evidences;
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
DROP POLICY IF EXISTS "Users can delete work order evidences" ON work_order_evidences;
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
DROP POLICY IF EXISTS "Users can view work order checklist items" ON work_order_checklist_items;
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
DROP POLICY IF EXISTS "Users can insert work order checklist items" ON work_order_checklist_items;
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
DROP POLICY IF EXISTS "Users can update work order checklist items" ON work_order_checklist_items;
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
DROP POLICY IF EXISTS "Users can delete work order checklist items" ON work_order_checklist_items;
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
DROP POLICY IF EXISTS "Users can view work order signatures" ON work_order_signatures;
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
DROP POLICY IF EXISTS "Users can insert work order signatures" ON work_order_signatures;
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
DROP POLICY IF EXISTS "Only master users can delete work order signatures" ON work_order_signatures;
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

