-- Aumentar limite máximo por OBJETO no bucket "documents".
-- Rode este SQL no editor SQL do projeto (ou `supabase db push` / migration).

-- ⚠️ Plano FREE do Supabase: o limite GLOBAL de upload não passa de 50 MB por arquivo,
--    mesmo que você aumente apenas o bucket — ajuste em:
--    Dashboard → Storage → Configuration (⚙️) → "Global file size limit"
--    Ver: https://supabase.com/docs/guides/storage/uploads/file-limits
--
-- Plano PRO+: pode aumentar o global (até 500 GB) e usar este valor no bucket também.

UPDATE storage.buckets
SET file_size_limit = 262144000 -- 250 MB (só tem efeito se o limite global do projeto ≥ 250 MB)
WHERE id = 'documents';

-- Conferência:
-- SELECT id, file_size_limit, allowed_mime_types FROM storage.buckets WHERE id = 'documents';
