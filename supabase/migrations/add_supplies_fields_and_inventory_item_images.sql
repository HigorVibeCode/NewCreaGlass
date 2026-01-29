-- Supplies-specific fields on inventory_items (aluminum/rubber profiles)
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS position VARCHAR(255),
ADD COLUMN IF NOT EXISTS color VARCHAR(255),
ADD COLUMN IF NOT EXISTS type VARCHAR(255),
ADD COLUMN IF NOT EXISTS opo_oeschger_code VARCHAR(255);

COMMENT ON COLUMN inventory_items.position IS 'Position (e.g. for aluminum/rubber profiles)';
COMMENT ON COLUMN inventory_items.color IS 'Color';
COMMENT ON COLUMN inventory_items.type IS 'Type';
COMMENT ON COLUMN inventory_items.opo_oeschger_code IS 'OPO Oeschger Code';

-- Table: up to 3 images per item, one can be main (displayed on card)
CREATE TABLE IF NOT EXISTS inventory_item_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_main BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_item_images_item_id ON inventory_item_images(item_id);

-- Ensure is_main column exists (in case table was created by an older migration without it)
ALTER TABLE inventory_item_images
ADD COLUMN IF NOT EXISTS is_main BOOLEAN NOT NULL DEFAULT false;

-- Ensure at most one main image per item (partial unique index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_item_images_one_main_per_item
  ON inventory_item_images(item_id) WHERE is_main = true;

-- RLS
ALTER TABLE inventory_item_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage inventory item images" ON inventory_item_images;
CREATE POLICY "Users can manage inventory item images"
  ON inventory_item_images
  FOR ALL
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
