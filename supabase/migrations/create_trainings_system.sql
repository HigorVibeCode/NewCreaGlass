-- ============================================================================
-- MIGRATION: Create Training System
-- ============================================================================
-- Sistema de treinamentos para Legal Requirements/Mandatory e Professional Training
-- ============================================================================

-- ============================================================================
-- 1. CREATE TRAININGS TABLE (Tabela de Treinamentos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS trainings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50) NOT NULL CHECK (category IN ('mandatory', 'professional')),
  content TEXT, -- Conteúdo do treinamento (pode ser HTML, markdown, etc)
  duration_minutes INTEGER, -- Duração estimada em minutos
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_trainings_category ON trainings(category);
CREATE INDEX IF NOT EXISTS idx_trainings_created_by ON trainings(created_by);
CREATE INDEX IF NOT EXISTS idx_trainings_created_at ON trainings(created_at);
CREATE INDEX IF NOT EXISTS idx_trainings_is_active ON trainings(is_active);

-- Enable RLS
ALTER TABLE trainings ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view trainings
DROP POLICY IF EXISTS "Users can view trainings" ON trainings;
CREATE POLICY "Users can view trainings"
  ON trainings
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
    -- Users with documents.view permission can view
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'documents.view'
    )
  );

-- RLS Policy: Users can insert trainings with documents.create permission
DROP POLICY IF EXISTS "Users can insert trainings" ON trainings;
CREATE POLICY "Users can insert trainings"
  ON trainings
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
    -- Users with documents.create permission can insert
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'documents.create'
    )
    AND created_by = auth.uid()
  );

-- RLS Policy: Users can update trainings with documents.update permission
DROP POLICY IF EXISTS "Users can update trainings" ON trainings;
CREATE POLICY "Users can update trainings"
  ON trainings
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
    -- Users with documents.update permission can update
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'documents.update'
    )
    AND created_by = auth.uid()
  );

-- RLS Policy: Users can delete trainings with documents.delete permission
DROP POLICY IF EXISTS "Users can delete trainings" ON trainings;
CREATE POLICY "Users can delete trainings"
  ON trainings
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
    -- Users with documents.delete permission can delete
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'documents.delete'
    )
    AND created_by = auth.uid()
  );

-- ============================================================================
-- 2. CREATE TRAINING_COMPLETIONS TABLE (Tabela de Conclusões de Treinamentos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), -- Quando o usuário abriu o treinamento
  completed_at TIMESTAMPTZ, -- Quando o usuário concluiu (após assinar)
  time_spent_seconds INTEGER NOT NULL DEFAULT 0, -- Tempo total de permanência com o treinamento aberto (em segundos)
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_training_completions_training_id ON training_completions(training_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_user_id ON training_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_training_completions_completed_at ON training_completions(completed_at);
CREATE INDEX IF NOT EXISTS idx_training_completions_user_training ON training_completions(user_id, training_id);

-- Unique constraint: One completion per user per training
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_completions_unique_user_training ON training_completions(user_id, training_id);

-- Enable RLS
ALTER TABLE training_completions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own completions, Master can view all
DROP POLICY IF EXISTS "Users can view training completions" ON training_completions;
CREATE POLICY "Users can view training completions"
  ON training_completions
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
    -- Users can view their own completions
    user_id = auth.uid()
  );

-- RLS Policy: Users can insert their own completions
DROP POLICY IF EXISTS "Users can insert training completions" ON training_completions;
CREATE POLICY "Users can insert training completions"
  ON training_completions
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
  );

-- RLS Policy: Users can update their own completions
DROP POLICY IF EXISTS "Users can update training completions" ON training_completions;
CREATE POLICY "Users can update training completions"
  ON training_completions
  FOR UPDATE
  USING (
    user_id = auth.uid()
  );

-- ============================================================================
-- 3. CREATE TRAINING_SIGNATURES TABLE (Tabela de Assinaturas de Treinamentos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_completion_id UUID NOT NULL REFERENCES training_completions(id) ON DELETE CASCADE,
  signature_path TEXT NOT NULL, -- Storage path to signature image
  full_name VARCHAR(255) NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_training_signatures_completion_id ON training_signatures(training_completion_id);
CREATE INDEX IF NOT EXISTS idx_training_signatures_created_by ON training_signatures(created_by);
CREATE INDEX IF NOT EXISTS idx_training_signatures_timestamp ON training_signatures(timestamp);

-- Unique constraint: One signature per completion
CREATE UNIQUE INDEX IF NOT EXISTS idx_training_signatures_unique_completion ON training_signatures(training_completion_id);

-- Enable RLS
ALTER TABLE training_signatures ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view signatures for completions they can view
DROP POLICY IF EXISTS "Users can view training signatures" ON training_signatures;
CREATE POLICY "Users can view training signatures"
  ON training_signatures
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
    -- Users can view signatures for their own completions
    EXISTS (
      SELECT 1 FROM training_completions tc
      WHERE tc.id = training_signatures.training_completion_id
      AND tc.user_id = auth.uid()
    )
  );

-- RLS Policy: Users can insert signatures for their own completions
DROP POLICY IF EXISTS "Users can insert training signatures" ON training_signatures;
CREATE POLICY "Users can insert training signatures"
  ON training_signatures
  FOR INSERT
  WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM training_completions tc
      WHERE tc.id = training_signatures.training_completion_id
      AND tc.user_id = auth.uid()
    )
  );

-- ============================================================================
-- 4. CREATE TRIGGER TO UPDATE updated_at
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_trainings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for trainings table
DROP TRIGGER IF EXISTS trigger_update_trainings_updated_at ON trainings;
CREATE TRIGGER trigger_update_trainings_updated_at
  BEFORE UPDATE ON trainings
  FOR EACH ROW
  EXECUTE FUNCTION update_trainings_updated_at();
