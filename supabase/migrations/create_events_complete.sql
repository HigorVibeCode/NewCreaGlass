-- ============================================================================
-- MIGRATION COMPLETA: Events (Sistema de Eventos)
-- ============================================================================
-- Este arquivo contém TODAS as migrations necessárias para o sistema de
-- Events em um único arquivo.
--
-- Execute este arquivo completo no SQL Editor do Supabase para criar todas
-- as tabelas, índices, RLS policies necessários para o sistema de Eventos.
--
-- IMPORTANTE: Este arquivo inclui DROP POLICY IF EXISTS antes de cada
-- CREATE POLICY para evitar erros se as policies já existirem.
-- ============================================================================

-- ============================================================================
-- 1. CREATE EVENTS TABLE (Tabela Principal)
-- ============================================================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50) DEFAULT 'other',
  start_date DATE,
  end_date DATE,
  start_time TIME,
  end_time TIME,
  location TEXT,
  people TEXT DEFAULT '',
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events(created_by);
CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(end_date);

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

-- ============================================================================
-- 2. UPDATE EVENTS TABLE (Adicionar colunas se não existirem)
-- ============================================================================
-- Se a tabela events já existir sem essas colunas, adiciona-as
-- Se já existirem, os comandos serão ignorados

ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS people TEXT DEFAULT '';

-- Se people já existir como UUID[], remover e recriar como TEXT
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

-- ============================================================================
-- 3. CREATE EVENT_ATTACHMENTS TABLE (Anexos de Eventos)
-- ============================================================================

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
-- MIGRATION COMPLETA
-- ============================================================================
-- Tabelas criadas:
--   - events (tabela principal com todas as colunas)
--   - event_attachments (anexos de eventos)
--
-- Todas as RLS policies foram criadas com DROP POLICY IF EXISTS
-- Todos os índices foram criados com CREATE INDEX IF NOT EXISTS
-- ============================================================================
