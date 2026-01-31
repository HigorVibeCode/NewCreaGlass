-- ============================================================================
-- Ajuste de ponto: preservar original, gravar ajuste e auditoria.
-- Regra: só ajustar se criado há menos de 2 dias (validado no serviço).
-- ============================================================================

ALTER TABLE time_entries
  ADD COLUMN IF NOT EXISTS is_adjusted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adjusted_recorded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adjust_description VARCHAR(20),
  ADD COLUMN IF NOT EXISTS adjusted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS adjusted_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_is_adjusted ON time_entries(is_adjusted) WHERE is_adjusted = true;

-- UPDATE: somente dono do registro ou Master pode atualizar (regra de 2 dias no app)
DROP POLICY IF EXISTS "Users can update own time entries; Master can update any" ON time_entries;
CREATE POLICY "Users can update own time entries; Master can update any"
  ON time_entries
  FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.user_type = 'Master'
      AND u.is_active = true
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.user_type = 'Master'
      AND u.is_active = true
    )
  );
