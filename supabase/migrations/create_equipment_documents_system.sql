-- ============================================================================
-- MIGRATION: Equipment Documents System (Central de Documentos de Máquinas)
-- ============================================================================
-- Tabelas: equipment_machines, equipment_documents, equipment_document_attachments
-- Anexos no bucket "documents".
-- ============================================================================

-- ============================================================================
-- 1. EQUIPMENT_MACHINES TABLE (pastas de equipamento)
-- ============================================================================

CREATE TABLE IF NOT EXISTS equipment_machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'hardware',
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_machines_name ON equipment_machines(name);
CREATE INDEX IF NOT EXISTS idx_equipment_machines_created_at ON equipment_machines(created_at DESC);

ALTER TABLE equipment_machines ENABLE ROW LEVEL SECURITY;

-- RLS: view
DROP POLICY IF EXISTS "Users can view equipment_machines" ON equipment_machines;
CREATE POLICY "Users can view equipment_machines"
  ON equipment_machines FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.view')
  );

-- RLS: insert
DROP POLICY IF EXISTS "Users can insert equipment_machines" ON equipment_machines;
CREATE POLICY "Users can insert equipment_machines"
  ON equipment_machines FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.create')
  );

-- RLS: update
DROP POLICY IF EXISTS "Users can update equipment_machines" ON equipment_machines;
CREATE POLICY "Users can update equipment_machines"
  ON equipment_machines FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.create')
  );

-- RLS: delete
DROP POLICY IF EXISTS "Users can delete equipment_machines" ON equipment_machines;
CREATE POLICY "Users can delete equipment_machines"
  ON equipment_machines FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.delete')
  );

-- ============================================================================
-- 2. EQUIPMENT_DOCUMENTS TABLE (blocos de documento por equipamento)
-- ============================================================================

CREATE TABLE IF NOT EXISTS equipment_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id UUID NOT NULL REFERENCES equipment_machines(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  thumbnail_path TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equipment_documents_equipment_id ON equipment_documents(equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_documents_created_at ON equipment_documents(created_at DESC);

ALTER TABLE equipment_documents ENABLE ROW LEVEL SECURITY;

-- RLS: view
DROP POLICY IF EXISTS "Users can view equipment_documents" ON equipment_documents;
CREATE POLICY "Users can view equipment_documents"
  ON equipment_documents FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.view')
  );

-- RLS: insert
DROP POLICY IF EXISTS "Users can insert equipment_documents" ON equipment_documents;
CREATE POLICY "Users can insert equipment_documents"
  ON equipment_documents FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.create')
  );

-- RLS: update
DROP POLICY IF EXISTS "Users can update equipment_documents" ON equipment_documents;
CREATE POLICY "Users can update equipment_documents"
  ON equipment_documents FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.create')
  );

-- RLS: delete
DROP POLICY IF EXISTS "Users can delete equipment_documents" ON equipment_documents;
CREATE POLICY "Users can delete equipment_documents"
  ON equipment_documents FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.delete')
  );

-- ============================================================================
-- 3. EQUIPMENT_DOCUMENT_ATTACHMENTS TABLE (anexos por bloco - até 10)
-- ============================================================================

CREATE TABLE IF NOT EXISTS equipment_document_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES equipment_documents(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_equip_doc_attachments_document_id ON equipment_document_attachments(document_id);
CREATE INDEX IF NOT EXISTS idx_equip_doc_attachments_created_at ON equipment_document_attachments(created_at);

ALTER TABLE equipment_document_attachments ENABLE ROW LEVEL SECURITY;

-- RLS: view
DROP POLICY IF EXISTS "Users can view equipment_document_attachments" ON equipment_document_attachments;
CREATE POLICY "Users can view equipment_document_attachments"
  ON equipment_document_attachments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.view')
  );

-- RLS: insert
DROP POLICY IF EXISTS "Users can insert equipment_document_attachments" ON equipment_document_attachments;
CREATE POLICY "Users can insert equipment_document_attachments"
  ON equipment_document_attachments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.create')
  );

-- RLS: delete
DROP POLICY IF EXISTS "Users can delete equipment_document_attachments" ON equipment_document_attachments;
CREATE POLICY "Users can delete equipment_document_attachments"
  ON equipment_document_attachments FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.user_type = 'Master' AND users.is_active = true)
    OR EXISTS (SELECT 1 FROM user_permissions up JOIN permissions p ON p.id = up.permission_id WHERE up.user_id = auth.uid() AND p.key = 'documents.delete')
  );
