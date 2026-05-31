-- Novo grupo de inventário: Montage Accessories (mesmo modelo que Profiles / Supplies)
-- created_by é UUID (FK users) — reutiliza o created_by de um grupo existente.

INSERT INTO inventory_groups (name, created_by)
SELECT
  'Montage Accessories',
  ig.created_by
FROM inventory_groups ig
WHERE NOT EXISTS (
  SELECT 1 FROM inventory_groups WHERE name = 'Montage Accessories'
)
ORDER BY ig.created_at ASC
LIMIT 1;
