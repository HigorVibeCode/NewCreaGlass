-- ============================================================================
-- MIGRATION: Add INSERT policy for push_delivery_logs
-- ============================================================================
-- Adiciona política RLS para permitir INSERT na tabela push_delivery_logs
-- Isso permite que o sistema registre logs de entrega de push notifications
-- ============================================================================

-- Drop existing policy if it exists (for idempotency)
DROP POLICY IF EXISTS "Users can insert their own push delivery logs" ON push_delivery_logs;
DROP POLICY IF EXISTS "System can insert push delivery logs" ON push_delivery_logs;

-- Allow authenticated users to insert delivery logs
-- This policy allows:
-- 1. Users to insert logs for their own notifications (auth.uid() = user_id)
-- 2. Masters to insert logs for any user (system operations)
-- 3. Any authenticated user to insert logs if the notification exists
--    (this covers the case where the notification system processes notifications)
CREATE POLICY "System can insert push delivery logs"
  ON push_delivery_logs
  FOR INSERT
  WITH CHECK (
    -- Allow if user is authenticated
    auth.uid() IS NOT NULL
    AND (
      -- Allow if the log is for the authenticated user
      auth.uid() = user_id
      OR
      -- Allow if user is a Master (for system operations)
      EXISTS (
        SELECT 1 FROM users
        WHERE users.id = auth.uid()
        AND users.user_type = 'Master'
        AND users.is_active = true
      )
      OR
      -- Allow if the notification exists (this allows the notification system 
      -- to create logs when processing notifications for any user)
      -- In WITH CHECK, we can reference the column being inserted directly
      EXISTS (
        SELECT 1 FROM notifications
        WHERE notifications.id = push_delivery_logs.notification_id
      )
    )
  );

COMMENT ON POLICY "System can insert push delivery logs" ON push_delivery_logs IS 
  'Allows authenticated users to insert push delivery logs. Users can insert logs for their own notifications, Masters can insert for any user, and any authenticated user can insert logs for existing notifications (allows notification system to log deliveries).';
