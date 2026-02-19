-- Rename inventory groups:
--   "Supplies" → "Profiles"
--   "Spare Parts" → "Supplies"
--
-- Order matters: rename "Supplies" first to avoid collision.

UPDATE inventory_groups SET name = 'Profiles'    WHERE name = 'Supplies';
UPDATE inventory_groups SET name = 'Supplies'    WHERE name = 'Spare Parts';
