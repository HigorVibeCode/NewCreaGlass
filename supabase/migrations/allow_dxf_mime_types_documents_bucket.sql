-- Permitir upload de arquivos DXF no bucket "documents" (anexos de produção).

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
        'image/gif',
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'video/x-msvideo'
      ]::text[]
    )
    || ARRAY[
      'application/dxf',
      'application/x-dxf',
      'image/vnd.dxf',
      'model/vnd.dxf',
      'application/octet-stream'
    ]::text[]
  ) AS elem
)
WHERE id = 'documents';
