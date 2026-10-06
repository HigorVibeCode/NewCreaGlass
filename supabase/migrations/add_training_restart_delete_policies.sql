-- Permite "refazer treinamento": apagar conclusão (e assinatura em cascata) para voltar ao fluxo inicial.
-- Utilizador apaga a própria linha; Master pode apagar qualquer conclusão.

DROP POLICY IF EXISTS "Users delete own training completions or Master" ON training_completions;
CREATE POLICY "Users delete own training completions or Master"
  ON training_completions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.user_type = 'Master'
        AND users.is_active = true
    )
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Users delete signatures for own completions or Master" ON training_signatures;
CREATE POLICY "Users delete signatures for own completions or Master"
  ON training_signatures
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
        AND users.user_type = 'Master'
        AND users.is_active = true
    )
    OR EXISTS (
      SELECT 1 FROM training_completions tc
      WHERE tc.id = training_signatures.training_completion_id
        AND tc.user_id = auth.uid()
    )
  );
