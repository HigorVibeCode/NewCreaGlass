-- ============================================
-- MIGRAÇÃO SIMPLES: Adicionar supplier e reference_number
-- ============================================
-- Execute este script no Supabase SQL Editor
-- ============================================

-- Passo 1: Adicionar coluna supplier (ignora erro se já existir)
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS supplier VARCHAR(50);

-- Passo 2: Adicionar coluna reference_number (ignora erro se já existir)
ALTER TABLE inventory_items
ADD COLUMN IF NOT EXISTS reference_number VARCHAR(255);

-- Passo 3: Remover constraint antiga se existir
ALTER TABLE inventory_items
DROP CONSTRAINT IF EXISTS check_supplier_values;

-- Passo 4: Adicionar constraint para validar valores do supplier
ALTER TABLE inventory_items
ADD CONSTRAINT check_supplier_values 
CHECK (supplier IS NULL OR supplier IN ('3S', 'Crea Glass'));

-- Passo 5: Adicionar comentários (opcional)
COMMENT ON COLUMN inventory_items.supplier IS 'Supplier of the glass item: 3S or Crea Glass';
COMMENT ON COLUMN inventory_items.reference_number IS 'Reference number for the inventory item';

-- Passo 6: Verificar se as colunas foram criadas
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'inventory_items' 
  AND column_name IN ('supplier', 'reference_number')
ORDER BY column_name;
