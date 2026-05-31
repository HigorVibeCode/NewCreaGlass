-- ============================================================================
-- MIGRATION: Add Training Attachments Support
-- ============================================================================
-- Adiciona suporte para anexos PDF em treinamentos
-- ============================================================================

-- ============================================================================
-- 1. CREATE TRAINING_ATTACHMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS training_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_training_attachments_training_id ON training_attachments(training_id);
CREATE INDEX IF NOT EXISTS idx_training_attachments_created_at ON training_attachments(created_at);

-- Enable RLS
ALTER TABLE training_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view attachments for trainings they can view
DROP POLICY IF EXISTS "Users can view training attachments" ON training_attachments;
CREATE POLICY "Users can view training attachments"
  ON training_attachments
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

-- RLS Policy: Users can insert attachments with documents.create permission
DROP POLICY IF EXISTS "Users can insert training attachments" ON training_attachments;
CREATE POLICY "Users can insert training attachments"
  ON training_attachments
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
  );

-- RLS Policy: Users can delete attachments with documents.delete permission
DROP POLICY IF EXISTS "Users can delete training attachments" ON training_attachments;
CREATE POLICY "Users can delete training attachments"
  ON training_attachments
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
  );
