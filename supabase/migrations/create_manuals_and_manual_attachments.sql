-- ============================================================================
-- MIGRATION: Manuals (Equipamentos e Ferramentas - Manuais)
-- ============================================================================
-- Tabelas: manuals, manual_attachments. Anexos no bucket "documents" (PDF).
-- ============================================================================

-- ============================================================================
-- 1. MANUALS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS manuals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manuals_created_at ON manuals(created_at DESC);

ALTER TABLE manuals ENABLE ROW LEVEL SECURITY;

-- RLS: view
DROP POLICY IF EXISTS "Users can view manuals" ON manuals;
CREATE POLICY "Users can view manuals"
  ON manuals FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.view')
  );

-- RLS: insert
DROP POLICY IF EXISTS "Users can insert manuals" ON manuals;
CREATE POLICY "Users can insert manuals"
  ON manuals FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.create')
  );

-- RLS: update
DROP POLICY IF EXISTS "Users can update manuals" ON manuals;
CREATE POLICY "Users can update manuals"
  ON manuals FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.create')
  );

-- RLS: delete
DROP POLICY IF EXISTS "Users can delete manuals" ON manuals;
CREATE POLICY "Users can delete manuals"
  ON manuals FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.delete')
  );

-- ============================================================================
-- 2. MANUAL_ATTACHMENTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS manual_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manual_id UUID NOT NULL REFERENCES manuals(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_manual_attachments_manual_id ON manual_attachments(manual_id);
CREATE INDEX IF NOT EXISTS idx_manual_attachments_created_at ON manual_attachments(created_at);

ALTER TABLE manual_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view manual attachments" ON manual_attachments;
CREATE POLICY "Users can view manual attachments"
  ON manual_attachments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.view')
  );

DROP POLICY IF EXISTS "Users can insert manual attachments" ON manual_attachments;
CREATE POLICY "Users can insert manual attachments"
  ON manual_attachments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.create')
  );

DROP POLICY IF EXISTS "Users can delete manual attachments" ON manual_attachments;
CREATE POLICY "Users can delete manual attachments"
  ON manual_attachments FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.delete')
  );
