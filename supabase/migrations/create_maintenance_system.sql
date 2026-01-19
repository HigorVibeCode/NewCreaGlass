-- ============================================================================
-- MIGRATION: Create Maintenance Control System
-- ============================================================================
-- Sistema de controle de manutenção dentro de Documents/Equipment and Tools
-- ============================================================================

-- ============================================================================
-- 1. CREATE MAINTENANCE_RECORDS TABLE (Tabela de Registros de Manutenção)
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  equipment VARCHAR(255) NOT NULL,
  type VARCHAR(100) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_maintenance_records_created_by ON maintenance_records(created_by);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_created_at ON maintenance_records(created_at);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_equipment ON maintenance_records(equipment);
CREATE INDEX IF NOT EXISTS idx_maintenance_records_type ON maintenance_records(type);

-- Enable RLS
ALTER TABLE maintenance_records ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view maintenance records based on permissions
DROP POLICY IF EXISTS "Users can view maintenance records" ON maintenance_records;
CREATE POLICY "Users can view maintenance records"
  ON maintenance_records
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
    OR
    -- Users can view maintenance records they created
    created_by = auth.uid()
  );

-- RLS Policy: Users can insert maintenance records with documents.create permission
DROP POLICY IF EXISTS "Users can insert maintenance records" ON maintenance_records;
CREATE POLICY "Users can insert maintenance records"
  ON maintenance_records
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

-- RLS Policy: Users can update maintenance records with documents.update permission
DROP POLICY IF EXISTS "Users can update maintenance records" ON maintenance_records;
CREATE POLICY "Users can update maintenance records"
  ON maintenance_records
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
    OR
    -- Users can update maintenance records they created
    created_by = auth.uid()
  );

-- RLS Policy: Users can delete maintenance records with documents.delete permission
DROP POLICY IF EXISTS "Users can delete maintenance records" ON maintenance_records;
CREATE POLICY "Users can delete maintenance records"
  ON maintenance_records
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
    OR
    -- Users can delete maintenance records they created
    created_by = auth.uid()
  );

-- ============================================================================
-- 2. CREATE MAINTENANCE_INFOS TABLE (Tabela de Informações - Info Boxes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_infos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_record_id UUID NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_infos_record_id ON maintenance_infos(maintenance_record_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_infos_order_index ON maintenance_infos(maintenance_record_id, order_index);

-- Enable RLS
ALTER TABLE maintenance_infos ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view maintenance infos if they can view the parent record
DROP POLICY IF EXISTS "Users can view maintenance infos" ON maintenance_infos;
CREATE POLICY "Users can view maintenance infos"
  ON maintenance_infos
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records
      WHERE maintenance_records.id = maintenance_infos.maintenance_record_id
      AND (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.user_type = 'Master'
          AND users.is_active = true
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = auth.uid()
          AND p.key = 'documents.view'
        )
        OR
        maintenance_records.created_by = auth.uid()
      )
    )
  );

-- RLS Policy: Users can insert maintenance infos if they can update the parent record
DROP POLICY IF EXISTS "Users can insert maintenance infos" ON maintenance_infos;
CREATE POLICY "Users can insert maintenance infos"
  ON maintenance_infos
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM maintenance_records
      WHERE maintenance_records.id = maintenance_infos.maintenance_record_id
      AND (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.user_type = 'Master'
          AND users.is_active = true
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = auth.uid()
          AND p.key = 'documents.update'
        )
        OR
        maintenance_records.created_by = auth.uid()
      )
    )
  );

-- RLS Policy: Users can update maintenance infos if they can update the parent record
DROP POLICY IF EXISTS "Users can update maintenance infos" ON maintenance_infos;
CREATE POLICY "Users can update maintenance infos"
  ON maintenance_infos
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records
      WHERE maintenance_records.id = maintenance_infos.maintenance_record_id
      AND (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.user_type = 'Master'
          AND users.is_active = true
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = auth.uid()
          AND p.key = 'documents.update'
        )
        OR
        maintenance_records.created_by = auth.uid()
      )
    )
  );

-- RLS Policy: Users can delete maintenance infos if they can update the parent record
DROP POLICY IF EXISTS "Users can delete maintenance infos" ON maintenance_infos;
CREATE POLICY "Users can delete maintenance infos"
  ON maintenance_infos
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records
      WHERE maintenance_records.id = maintenance_infos.maintenance_record_id
      AND (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.user_type = 'Master'
          AND users.is_active = true
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = auth.uid()
          AND p.key = 'documents.update'
        )
        OR
        maintenance_records.created_by = auth.uid()
      )
    )
  );

-- ============================================================================
-- 3. CREATE MAINTENANCE_INFO_IMAGES TABLE (Tabela de Imagens das Informações)
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_info_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_info_id UUID NOT NULL REFERENCES maintenance_infos(id) ON DELETE CASCADE,
  storage_path VARCHAR(500) NOT NULL,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_info_images_info_id ON maintenance_info_images(maintenance_info_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_info_images_order ON maintenance_info_images(maintenance_info_id, order_index);

-- Enable RLS
ALTER TABLE maintenance_info_images ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view images if they can view the parent info
DROP POLICY IF EXISTS "Users can view maintenance info images" ON maintenance_info_images;
CREATE POLICY "Users can view maintenance info images"
  ON maintenance_info_images
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_infos
      JOIN maintenance_records ON maintenance_records.id = maintenance_infos.maintenance_record_id
      WHERE maintenance_infos.id = maintenance_info_images.maintenance_info_id
      AND (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.user_type = 'Master'
          AND users.is_active = true
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = auth.uid()
          AND p.key = 'documents.view'
        )
        OR
        maintenance_records.created_by = auth.uid()
      )
    )
  );

-- RLS Policy: Users can insert images if they can update the parent info
DROP POLICY IF EXISTS "Users can insert maintenance info images" ON maintenance_info_images;
CREATE POLICY "Users can insert maintenance info images"
  ON maintenance_info_images
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM maintenance_infos
      JOIN maintenance_records ON maintenance_records.id = maintenance_infos.maintenance_record_id
      WHERE maintenance_infos.id = maintenance_info_images.maintenance_info_id
      AND (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.user_type = 'Master'
          AND users.is_active = true
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = auth.uid()
          AND p.key = 'documents.update'
        )
        OR
        maintenance_records.created_by = auth.uid()
      )
    )
  );

-- RLS Policy: Users can delete images if they can update the parent info
DROP POLICY IF EXISTS "Users can delete maintenance info images" ON maintenance_info_images;
CREATE POLICY "Users can delete maintenance info images"
  ON maintenance_info_images
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_infos
      JOIN maintenance_records ON maintenance_records.id = maintenance_infos.maintenance_record_id
      WHERE maintenance_infos.id = maintenance_info_images.maintenance_info_id
      AND (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.user_type = 'Master'
          AND users.is_active = true
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = auth.uid()
          AND p.key = 'documents.update'
        )
        OR
        maintenance_records.created_by = auth.uid()
      )
    )
  );

-- ============================================================================
-- 4. CREATE MAINTENANCE_HISTORY TABLE (Tabela de Histórico de Alterações)
-- ============================================================================

CREATE TABLE IF NOT EXISTS maintenance_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_record_id UUID NOT NULL REFERENCES maintenance_records(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  change_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'info_added', 'info_updated', 'info_deleted', 'image_added', 'image_deleted'
  change_description TEXT,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_history_record_id ON maintenance_history(maintenance_record_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_history_changed_at ON maintenance_history(maintenance_record_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_history_changed_by ON maintenance_history(changed_by);

-- Enable RLS
ALTER TABLE maintenance_history ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view history if they can view the parent record
DROP POLICY IF EXISTS "Users can view maintenance history" ON maintenance_history;
CREATE POLICY "Users can view maintenance history"
  ON maintenance_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM maintenance_records
      WHERE maintenance_records.id = maintenance_history.maintenance_record_id
      AND (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.user_type = 'Master'
          AND users.is_active = true
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = auth.uid()
          AND p.key = 'documents.view'
        )
        OR
        maintenance_records.created_by = auth.uid()
      )
    )
  );

-- RLS Policy: Users can insert history if they can update the parent record
DROP POLICY IF EXISTS "Users can insert maintenance history" ON maintenance_history;
CREATE POLICY "Users can insert maintenance history"
  ON maintenance_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM maintenance_records
      WHERE maintenance_records.id = maintenance_history.maintenance_record_id
      AND (
        EXISTS (
          SELECT 1 FROM users
          WHERE users.id = auth.uid()
          AND users.user_type = 'Master'
          AND users.is_active = true
        )
        OR
        EXISTS (
          SELECT 1 FROM user_permissions up
          JOIN permissions p ON p.id = up.permission_id
          WHERE up.user_id = auth.uid()
          AND p.key = 'documents.update'
        )
        OR
        maintenance_records.created_by = auth.uid()
      )
    )
  );

-- ============================================================================
-- 5. CREATE TRIGGERS
-- ============================================================================

-- Trigger to update updated_at timestamp on maintenance_records
CREATE OR REPLACE FUNCTION update_maintenance_records_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_maintenance_records_updated_at ON maintenance_records;
CREATE TRIGGER trigger_update_maintenance_records_updated_at
  BEFORE UPDATE ON maintenance_records
  FOR EACH ROW
  EXECUTE FUNCTION update_maintenance_records_updated_at();

-- Trigger to update updated_at timestamp on maintenance_infos
CREATE OR REPLACE FUNCTION update_maintenance_infos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_maintenance_infos_updated_at ON maintenance_infos;
CREATE TRIGGER trigger_update_maintenance_infos_updated_at
  BEFORE UPDATE ON maintenance_infos
  FOR EACH ROW
  EXECUTE FUNCTION update_maintenance_infos_updated_at();

-- Trigger to enforce max 3 images per info
CREATE OR REPLACE FUNCTION check_max_images_per_info()
RETURNS TRIGGER AS $$
DECLARE
  image_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO image_count
  FROM maintenance_info_images
  WHERE maintenance_info_id = NEW.maintenance_info_id;
  
  IF image_count >= 3 THEN
    RAISE EXCEPTION 'Maximum of 3 images allowed per maintenance info';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_max_images_per_info ON maintenance_info_images;
CREATE TRIGGER trigger_check_max_images_per_info
  BEFORE INSERT ON maintenance_info_images
  FOR EACH ROW
  EXECUTE FUNCTION check_max_images_per_info();
