-- ============================================================================
-- Migration: Auto-preenchimento de marcações de ponto faltantes
--
-- Todos os dias úteis (seg-sex) às 22:59 UTC (23:59 CET),
-- verifica se cada usuário ativo tem entrada e saída registradas.
-- Se faltar, insere automaticamente:
--   - Entrada (clock_in) → 07:30 horário local
--   - Saída (clock_out)  → 17:00 horário local
--
-- Marcações automáticas têm location_address = 'Automático'
-- ============================================================================

-- 1. Função que auto-preenche marcações faltantes do dia
CREATE OR REPLACE FUNCTION fn_auto_fill_time_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  today_date DATE;
  has_clock_in BOOLEAN;
  has_clock_out BOOLEAN;
  clock_in_ts TIMESTAMPTZ;
  clock_out_ts TIMESTAMPTZ;
BEGIN
  -- Data de hoje no timezone da Suíça
  today_date := (NOW() AT TIME ZONE 'Europe/Zurich')::date;

  -- Verificar se é dia útil (1=segunda ... 5=sexta)
  IF EXTRACT(ISODOW FROM today_date) > 5 THEN
    RETURN; -- Fim de semana, não fazer nada
  END IF;

  -- Horários padrão no timezone local, convertidos para TIMESTAMPTZ
  clock_in_ts  := (today_date || ' 07:30:00')::timestamp AT TIME ZONE 'Europe/Zurich';
  clock_out_ts := (today_date || ' 17:00:00')::timestamp AT TIME ZONE 'Europe/Zurich';

  -- Iterar sobre cada usuário ativo
  FOR r IN
    SELECT id, username FROM users WHERE is_active = true
  LOOP
    -- Verificar se já tem clock_in hoje
    SELECT EXISTS (
      SELECT 1 FROM time_entries
      WHERE user_id = r.id
        AND entry_type = 'clock_in'
        AND (recorded_at AT TIME ZONE 'Europe/Zurich')::date = today_date
    ) INTO has_clock_in;

    -- Verificar se já tem clock_out hoje
    SELECT EXISTS (
      SELECT 1 FROM time_entries
      WHERE user_id = r.id
        AND entry_type = 'clock_out'
        AND (recorded_at AT TIME ZONE 'Europe/Zurich')::date = today_date
    ) INTO has_clock_out;

    -- Inserir clock_in automático se faltante
    IF NOT has_clock_in THEN
      INSERT INTO time_entries (user_id, user_name, recorded_at, entry_type, location_address)
      VALUES (r.id, r.username, clock_in_ts, 'clock_in', 'Automático');
    END IF;

    -- Inserir clock_out automático se faltante
    IF NOT has_clock_out THEN
      INSERT INTO time_entries (user_id, user_name, recorded_at, entry_type, location_address)
      VALUES (r.id, r.username, clock_out_ts, 'clock_out', 'Automático');
    END IF;
  END LOOP;
END;
$$;

-- 2. Agendar o job pg_cron: seg-sex às 22:59 UTC = 23:59 CET (horário de inverno)
-- Durante horário de verão (CEST), rodará às 00:59 do dia seguinte local.
-- Para ajustar no verão, altere para '59 21 * * 1-5'.
SELECT cron.schedule(
  'auto-fill-time-entries',
  '59 22 * * 1-5',
  $$SELECT fn_auto_fill_time_entries()$$
);
