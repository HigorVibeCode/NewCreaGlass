-- ============================================
-- SCRIPT DE DIAGNÓSTICO
-- Execute este script primeiro para entender o problema
-- ============================================

-- 1. Verificar se a tabela existe
SELECT 
    'Tabela existe?' as check_type,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'inventory_items'
        ) THEN 'SIM ✅'
        ELSE 'NÃO ❌'
    END as result;

-- 2. Listar todas as colunas da tabela
SELECT 
    'Colunas existentes' as check_type,
    column_name,
    data_type,
    character_maximum_length,
    is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'inventory_items'
ORDER BY ordinal_position;

-- 3. Verificar especificamente as colunas que queremos adicionar
SELECT 
    'Colunas supplier e reference_number' as check_type,
    column_name,
    CASE 
        WHEN column_name = 'supplier' THEN '✅ EXISTE'
        WHEN column_name = 'reference_number' THEN '✅ EXISTE'
        ELSE '❌ NÃO EXISTE'
    END as status
FROM information_schema.columns 
WHERE table_schema = 'public'
  AND table_name = 'inventory_items' 
  AND column_name IN ('supplier', 'reference_number');

-- 4. Verificar constraints existentes
SELECT 
    'Constraints' as check_type,
    constraint_name,
    constraint_type
FROM information_schema.table_constraints 
WHERE table_schema = 'public'
  AND table_name = 'inventory_items'
ORDER BY constraint_type, constraint_name;
