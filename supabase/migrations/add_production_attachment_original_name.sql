-- ============================================================================
-- Production attachments: nome original para exibição + storage_path único
-- ============================================================================

ALTER TABLE production_attachments
  ADD COLUMN IF NOT EXISTS original_name TEXT;

UPDATE production_attachments
SET original_name = filename
WHERE original_name IS NULL OR TRIM(original_name) = '';

COMMENT ON COLUMN production_attachments.original_name IS
  'Nome original do arquivo no upload (somente exibição). storage_path contém chave única uuid__nome.';

COMMENT ON COLUMN production_attachments.storage_path IS
  'Chave no bucket (ex: {uuid}__planta.dxf). Não usar como nome de exibição.';
