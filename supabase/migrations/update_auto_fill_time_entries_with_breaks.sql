-- ============================================================================
-- Migration: Estender auto-preenchimento de ponto para pausas
--
-- A função fn_auto_fill_time_entries passa a preencher automaticamente:
--   - clock_in      -> 07:30
--   - coffee_start  -> 09:00
--   - coffee_end    -> 09:15
--   - lunch_start   -> 12:15
--   - lunch_end     -> 13:00
--   - clock_out     -> 17:00
--
-- Todas as marcações automáticas usam location_address = 'Automático'
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_fill_time_entries()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
  today_date DATE;
  has_clock_in BOOLEAN;
  has_coffee_start BOOLEAN;
  has_coffee_end BOOLEAN;
  has_lunch_start BOOLEAN;
  has_lunch_end BOOLEAN;
  has_clock_out BOOLEAN;
  clock_in_ts TIMESTAMPTZ;
  coffee_start_ts TIMESTAMPTZ;
  coffee_end_ts TIMESTAMPTZ;
  lunch_start_ts TIMESTAMPTZ;
  lunch_end_ts TIMESTAMPTZ;
  clock_out_ts TIMESTAMPTZ;
BEGIN
  -- Data de hoje no timezone da Suíça
  today_date := (NOW() AT TIME ZONE 'Europe/Zurich')::date;

  -- Verificar se é dia útil (1=segunda ... 5=sexta)
  IF EXTRACT(ISODOW FROM today_date) > 5 THEN
    RETURN; -- Fim de semana, não fazer nada
  END IF;

  -- Horários padrão no timezone local, convertidos para TIMESTAMPTZ
  clock_in_ts     := (today_date || ' 07:30:00')::timestamp AT TIME ZONE 'Europe/Zurich';
  coffee_start_ts := (today_date || ' 09:00:00')::timestamp AT TIME ZONE 'Europe/Zurich';
  coffee_end_ts   := (today_date || ' 09:15:00')::timestamp AT TIME ZONE 'Europe/Zurich';
  lunch_start_ts  := (today_date || ' 12:15:00')::timestamp AT TIME ZONE 'Europe/Zurich';
  lunch_end_ts    := (today_date || ' 13:00:00')::timestamp AT TIME ZONE 'Europe/Zurich';
  clock_out_ts    := (today_date || ' 17:00:00')::timestamp AT TIME ZONE 'Europe/Zurich';

  -- Iterar sobre cada usuário ativo
  FOR r IN
    SELECT id, username FROM users WHERE is_active = true
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM time_entries
      WHERE user_id = r.id
        AND entry_type = 'clock_in'
        AND (recorded_at AT TIME ZONE 'Europe/Zurich')::date = today_date
    ) INTO has_clock_in;

    SELECT EXISTS (
      SELECT 1 FROM time_entries
      WHERE user_id = r.id
        AND entry_type = 'coffee_start'
        AND (recorded_at AT TIME ZONE 'Europe/Zurich')::date = today_date
    ) INTO has_coffee_start;

    SELECT EXISTS (
      SELECT 1 FROM time_entries
      WHERE user_id = r.id
        AND entry_type = 'coffee_end'
        AND (recorded_at AT TIME ZONE 'Europe/Zurich')::date = today_date
    ) INTO has_coffee_end;

    SELECT EXISTS (
      SELECT 1 FROM time_entries
      WHERE user_id = r.id
        AND entry_type = 'lunch_start'
        AND (recorded_at AT TIME ZONE 'Europe/Zurich')::date = today_date
    ) INTO has_lunch_start;

    SELECT EXISTS (
      SELECT 1 FROM time_entries
      WHERE user_id = r.id
        AND entry_type = 'lunch_end'
        AND (recorded_at AT TIME ZONE 'Europe/Zurich')::date = today_date
    ) INTO has_lunch_end;

    SELECT EXISTS (
      SELECT 1 FROM time_entries
      WHERE user_id = r.id
        AND entry_type = 'clock_out'
        AND (recorded_at AT TIME ZONE 'Europe/Zurich')::date = today_date
    ) INTO has_clock_out;

    IF NOT has_clock_in THEN
      INSERT INTO time_entries (user_id, user_name, recorded_at, entry_type, location_address)
      VALUES (r.id, r.username, clock_in_ts, 'clock_in', 'Automático');
    END IF;

    IF NOT has_coffee_start THEN
      INSERT INTO time_entries (user_id, user_name, recorded_at, entry_type, location_address)
      VALUES (r.id, r.username, coffee_start_ts, 'coffee_start', 'Automático');
    END IF;

    IF NOT has_coffee_end THEN
      INSERT INTO time_entries (user_id, user_name, recorded_at, entry_type, location_address)
      VALUES (r.id, r.username, coffee_end_ts, 'coffee_end', 'Automático');
    END IF;

    IF NOT has_lunch_start THEN
      INSERT INTO time_entries (user_id, user_name, recorded_at, entry_type, location_address)
      VALUES (r.id, r.username, lunch_start_ts, 'lunch_start', 'Automático');
    END IF;

    IF NOT has_lunch_end THEN
      INSERT INTO time_entries (user_id, user_name, recorded_at, entry_type, location_address)
      VALUES (r.id, r.username, lunch_end_ts, 'lunch_end', 'Automático');
    END IF;

    IF NOT has_clock_out THEN
      INSERT INTO time_entries (user_id, user_name, recorded_at, entry_type, location_address)
      VALUES (r.id, r.username, clock_out_ts, 'clock_out', 'Automático');
    END IF;
  END LOOP;
END;
$$;
