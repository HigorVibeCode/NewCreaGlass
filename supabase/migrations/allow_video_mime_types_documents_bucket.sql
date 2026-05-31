-- Permitir upload de vídeos no bucket "documents" (anexos de treinamento, produção, etc.)
-- Adiciona os MIME types de vídeo à lista permitida do bucket.

-- Se o bucket já tem allowed_mime_types definido: adiciona os tipos de vídeo.
-- Se allowed_mime_types for NULL: define lista completa (documentos + imagens + vídeos).
UPDATE storage.buckets
SET allowed_mime_types = (
  SELECT array_agg(DISTINCT elem ORDER BY elem)
  FROM unnest(
    COALESCE(
      allowed_mime_types,
      ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/gif'
      ]::text[]
    )
    || ARRAY[
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/x-msvideo'
    ]::text[]
  ) AS elem
)
WHERE id = 'documents';

-- Se o bucket "documents" não existir na tabela (criado apenas pelo Dashboard),
-- em Storage > documents > Settings > Allowed MIME types adicione:
-- video/mp4, video/quicktime, video/webm, video/x-msvideo
