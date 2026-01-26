-- Add supplier and reference_number columns to inventory_items table
-- These fields are specific to glass inventory items

ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS supplier VARCHAR(50),
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255);

-- Drop constraint if it exists, then add constraint to ensure supplier is either '3S' or 'Crea Glass' if provided
ALTER TABLE inventory_items
DROP CONSTRAINT IF EXISTS check_supplier_values;

ALTER TABLE inventory_items
ADD CONSTRAINT check_supplier_values 
CHECK (supplier IS NULL OR supplier IN ('3S', 'Crea Glass'));

-- Add comment to document the columns
COMMENT ON COLUMN inventory_items.supplier IS 'Supplier of the glass item: 3S or Crea Glass';
COMMENT ON COLUMN inventory_items.reference_number IS 'Reference number for the inventory item';
