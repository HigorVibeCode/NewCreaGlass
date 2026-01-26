-- ============================================
-- VERSÃO ULTRA SIMPLES - Execute linha por linha se necessário
-- ============================================

-- 1. Adicionar coluna supplier
ALTER TABLE inventory_items ADD COLUMN supplier VARCHAR(50);

-- 2. Adicionar coluna reference_number  
ALTER TABLE inventory_items ADD COLUMN reference_number VARCHAR(255);

-- 3. Verificar se funcionou
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'inventory_items' 
AND column_name IN ('supplier', 'reference_number');
