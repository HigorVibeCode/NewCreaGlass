-- ============================================================================
-- MIGRATION: Create Push Notifications System
-- ============================================================================
-- Cria as tabelas necessárias para suporte a push notifications:
-- - device_tokens: tokens de dispositivos dos usuários
-- - notification_preferences: preferências de notificação por usuário
-- - push_delivery_logs: logs de envio de push notifications
-- ============================================================================

-- ============================================================================
-- 1. DEVICE TOKENS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  token TEXT NOT NULL,
  device_id TEXT,
  app_version TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token, platform)
);

-- Indexes for device_tokens
CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens(token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_active ON device_tokens(user_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_device_tokens_platform ON device_tokens(platform);

-- ============================================================================
-- 2. NOTIFICATION PREFERENCES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  push_enabled BOOLEAN NOT NULL DEFAULT true,
  work_orders_enabled BOOLEAN NOT NULL DEFAULT true,
  inventory_enabled BOOLEAN NOT NULL DEFAULT true,
  training_enabled BOOLEAN NOT NULL DEFAULT true,
  blood_priority_enabled BOOLEAN NOT NULL DEFAULT true,
  production_enabled BOOLEAN NOT NULL DEFAULT true,
  events_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);

-- ============================================================================
-- 3. PUSH DELIVERY LOGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS push_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_token_id UUID REFERENCES device_tokens(id) ON DELETE SET NULL,
  token TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'delivered')),
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for push_delivery_logs
CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_notification_id ON push_delivery_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_user_id ON push_delivery_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_status ON push_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_push_delivery_logs_created_at ON push_delivery_logs(created_at DESC);

-- ============================================================================
-- 4. ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE device_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_delivery_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 5. RLS POLICIES - DEVICE TOKENS
-- ============================================================================

-- Users can view their own device tokens
CREATE POLICY "Users can view their own device tokens"
  ON device_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own device tokens
CREATE POLICY "Users can insert their own device tokens"
  ON device_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own device tokens
CREATE POLICY "Users can update their own device tokens"
  ON device_tokens
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own device tokens
CREATE POLICY "Users can delete their own device tokens"
  ON device_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Master users can manage all device tokens
CREATE POLICY "Master users can manage all device tokens"
  ON device_tokens
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
  );

-- ============================================================================
-- 6. RLS POLICIES - NOTIFICATION PREFERENCES
-- ============================================================================

-- Users can view their own preferences
CREATE POLICY "Users can view their own notification preferences"
  ON notification_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert their own notification preferences"
  ON notification_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update their own notification preferences"
  ON notification_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Master users can manage all preferences
CREATE POLICY "Master users can manage all notification preferences"
  ON notification_preferences
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
  );

-- ============================================================================
-- 7. RLS POLICIES - PUSH DELIVERY LOGS
-- ============================================================================

-- Users can view their own delivery logs
CREATE POLICY "Users can view their own push delivery logs"
  ON push_delivery_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- System can insert delivery logs (via service role)
-- Note: This will be handled by backend service, not directly by users
-- For now, we'll allow users to view their own logs only

-- Master users can view all delivery logs
CREATE POLICY "Master users can view all push delivery logs"
  ON push_delivery_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
  );

-- ============================================================================
-- 8. TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for device_tokens
CREATE TRIGGER update_device_tokens_updated_at
  BEFORE UPDATE ON device_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Triggers for notification_preferences
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 9. HELPER FUNCTION: Get active device tokens for user
-- ============================================================================
CREATE OR REPLACE FUNCTION get_active_device_tokens(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  token TEXT,
  platform TEXT,
  device_id TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dt.id,
    dt.token,
    dt.platform,
    dt.device_id
  FROM device_tokens dt
  WHERE dt.user_id = p_user_id
    AND dt.is_active = true
    AND EXISTS (
      SELECT 1 FROM notification_preferences np
      WHERE np.user_id = p_user_id
        AND np.push_enabled = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 10. COMMENTS
-- ============================================================================
COMMENT ON TABLE device_tokens IS 'Stores push notification tokens for user devices';
COMMENT ON TABLE notification_preferences IS 'User preferences for push notifications by category';
COMMENT ON TABLE push_delivery_logs IS 'Logs of push notification delivery attempts and status';
