-- ============================================================================
-- MIGRATION: Create Time Entries (Controle de Ponto) System
-- ============================================================================
-- Marcações de ponto por usuário: nome, data/hora (servidor), local, GPS.
-- Usuário comum vê apenas seus registros; Master vê todos.
-- ============================================================================

-- ============================================================================
-- 1. CREATE TIME_ENTRIES TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  user_name VARCHAR(255) NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  location_address TEXT,
  gps_accuracy REAL,
  gps_source VARCHAR(20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_id ON time_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_recorded_at ON time_entries(recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_recorded ON time_entries(user_id, recorded_at DESC);

-- Enable RLS
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;

-- SELECT: usuário vê só os seus; Master vê todos
DROP POLICY IF EXISTS "Users can view own time entries; Master views all" ON time_entries;
CREATE POLICY "Users can view own time entries; Master views all"
  ON time_entries
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.user_type = 'Master'
      AND u.is_active = true
    )
  );

-- INSERT: usuário só pode inserir para si (user_id = auth.uid())
DROP POLICY IF EXISTS "Users can insert own time entries" ON time_entries;
CREATE POLICY "Users can insert own time entries"
  ON time_entries
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Sem UPDATE/DELETE: marcações são imutáveis.

-- ============================================================================
-- 2. RPC: get_server_time() para registrar com horário do servidor
-- ============================================================================

CREATE OR REPLACE FUNCTION get_server_time()
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT NOW();
$$;

-- Permitir chamada autenticada
-- (RLS não se aplica a funções; a função usa NOW() do servidor.)
