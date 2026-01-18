-- ============================================================================
-- FIX SIGNATURES RLS RECURSION AND CREATE STORAGE BUCKET
-- ============================================================================
-- This migration fixes the infinite recursion error in work_order_signatures
-- RLS policy and creates the 'signatures' storage bucket for signature images.
--
-- Execute this file in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- 1. FIX RLS POLICY - Remove recursion
-- ============================================================================

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
      -- Removed NOT EXISTS check - UNIQUE INDEX already enforces one signature per work order
    )
  );

-- ============================================================================
-- 2. CREATE STORAGE BUCKET FOR SIGNATURES
-- ============================================================================

-- Create the 'signatures' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'signatures',
  'signatures',
  true, -- Public bucket so signatures can be accessed via URL
  5242880, -- 5MB file size limit (enough for PNG signature images)
  ARRAY['image/png', 'image/jpeg', 'image/jpg']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 3. STORAGE POLICIES FOR SIGNATURES BUCKET
-- ============================================================================

-- Policy: Users can upload signature images
DROP POLICY IF EXISTS "Users can upload signature images" ON storage.objects;
CREATE POLICY "Users can upload signature images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'signatures'
    AND (
      -- Master users can upload
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.user_type = 'Master'
        AND users.is_active = true
      )
      OR
      -- Users with workOrders.signature permission can upload
      EXISTS (
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = auth.uid()
        AND p.key = 'workOrders.signature'
      )
    )
  );

-- Policy: Users can view signature images (public bucket, but we add explicit policy)
DROP POLICY IF EXISTS "Users can view signature images" ON storage.objects;
CREATE POLICY "Users can view signature images"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'signatures'
    AND (
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
        SELECT 1 FROM work_order_signatures wos
        JOIN work_orders wo ON wo.id = wos.work_order_id
        WHERE wos.signature_path LIKE '%' || storage.objects.name
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
      -- Public bucket allows access via URL, but policy provides additional security
    )
  );

-- Policy: Users cannot update or delete signature images (immutable after creation)
-- Only Master users can delete for corrections
DROP POLICY IF EXISTS "Only master users can delete signature images" ON storage.objects;
CREATE POLICY "Only master users can delete signature images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'signatures'
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
  );
