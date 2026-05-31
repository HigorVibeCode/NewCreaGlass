-- Permite que usuários com permissão documents.view listem e leiam objetos no bucket "documents".
-- Necessário para o fallback de anexos de produção quando storage_path no banco está incorreto
-- (ex.: UUID ou nome simples) e o arquivo real no Storage tem formato timestamp_nome.pdf.

DROP POLICY IF EXISTS "Users with documents.view can list and read documents bucket" ON storage.objects;
CREATE POLICY "Users with documents.view can list and read documents bucket"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'documents'
    AND (
      EXISTS (
        SELECT 1 FROM user_permissions up
        JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = auth.uid()
        AND p.key = 'documents.view'
      )
      OR EXISTS (
        SELECT 1 FROM users u
        WHERE u.id = auth.uid()
        AND u.user_type = 'Master'
        AND u.is_active = true
      )
    )
  );
