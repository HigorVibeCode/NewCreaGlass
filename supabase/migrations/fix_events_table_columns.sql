-- ============================================================================
-- FIX: Adicionar colunas faltantes na tabela 'events'
-- ============================================================================
-- Execute este script no SQL Editor do Supabase se a coluna 'type' não existir
-- ============================================================================

ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS people TEXT DEFAULT '';
