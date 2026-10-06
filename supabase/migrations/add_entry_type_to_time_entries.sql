-- ============================================================================
-- Migration: Adicionar coluna entry_type à tabela time_entries
--
-- Separa marcações de ponto em 'clock_in' (entrada) e 'clock_out' (saída).
-- Registros existentes são preenchidos automaticamente com base na ordem
-- cronológica (1o = clock_in, 2o = clock_out, etc.)
-- ============================================================================

-- 1. Adicionar coluna
ALTER TABLE time_entries
ADD COLUMN IF NOT EXISTS entry_type VARCHAR(10) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_time_entries_entry_type
ON time_entries(entry_type);

-- 2. Backfill de registros existentes: alternar clock_in/clock_out por dia/usuário
DO $$
DECLARE
  rec RECORD;
  seq INT;
BEGIN
  FOR rec IN
    SELECT id, user_id,
           (recorded_at AT TIME ZONE 'Europe/Zurich')::date AS day,
           ROW_NUMBER() OVER (
             PARTITION BY user_id, (recorded_at AT TIME ZONE 'Europe/Zurich')::date
             ORDER BY COALESCE(adjusted_recorded_at, recorded_at) ASC
           ) AS rn
    FROM time_entries
    WHERE entry_type IS NULL
    ORDER BY user_id, day, rn
  LOOP
    IF rec.rn % 2 = 1 THEN
      UPDATE time_entries SET entry_type = 'clock_in' WHERE id = rec.id;
    ELSE
      UPDATE time_entries SET entry_type = 'clock_out' WHERE id = rec.id;
    END IF;
  END LOOP;
END;
$$;
