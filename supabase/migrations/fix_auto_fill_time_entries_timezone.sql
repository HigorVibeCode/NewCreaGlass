-- ============================================================================
-- Migration: corrige o preenchimento automático de ponto no horário de verão
--
-- Problema: o job rodava às 22:59 UTC. No horário de verão (CEST) isso é
-- 00:59 do DIA SEGUINTE em Zurique, então ele criava entrada 07:30 / saída 17:00
-- para o dia que estava começando. De manhã todos já tinham entrada e saída
-- (8h30 fixas) e os botões de ponto ficavam bloqueados.
--
-- Correção:
-- 1. Nova função que só chama fn_auto_fill_time_entries() às 23:xx de Zurique.
-- 2. O job roda às 21:59 e 22:59 UTC:
--    verão (CEST): 21:59 UTC = 23:59 local (preenche), 22:59 UTC = 00:59 (ignora)
--    inverno (CET): 21:59 UTC = 22:59 local (ignora), 22:59 UTC = 23:59 (preenche)
-- 3. Remove os registros automáticos de HOJE criados antes do horário que dizem
--    ter acontecido (pré-preenchimento indevido). Registros ajustados não mudam.
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_auto_fill_time_entries_end_of_day()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'Europe/Zurich')) = 23 THEN
    PERFORM fn_auto_fill_time_entries();
  END IF;
END;
$$;

DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN
    SELECT jobid FROM cron.job
    WHERE jobname = 'auto-fill-time-entries'
       OR command ILIKE '%fn_auto_fill_time_entries%'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;
END $$;

SELECT cron.schedule(
  'auto-fill-time-entries',
  '59 21,22 * * 1-5',
  $$SELECT fn_auto_fill_time_entries_end_of_day()$$
);

DELETE FROM time_entries
WHERE location_address = 'Automático'
  AND (recorded_at AT TIME ZONE 'Europe/Zurich')::date = (NOW() AT TIME ZONE 'Europe/Zurich')::date
  AND created_at < recorded_at
  AND COALESCE(is_adjusted, false) = false;
