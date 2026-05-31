-- ============================================================================
-- Migration: Disable automatic time entry creation
--
-- From now on, time entries must be created only by explicit user actions.
-- This migration:
-- 1) Unschedules the pg_cron job that auto-fills missing entries
-- 2) Removes the helper function used by that cron job
-- ============================================================================

DO $$
DECLARE
  job_record RECORD;
BEGIN
  -- Unschedule by known job name
  FOR job_record IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'auto-fill-time-entries'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;

  -- Defensive: unschedule any job invoking the same function command
  FOR job_record IN
    SELECT jobid
    FROM cron.job
    WHERE command ILIKE '%fn_auto_fill_time_entries%'
  LOOP
    PERFORM cron.unschedule(job_record.jobid);
  END LOOP;
EXCEPTION
  WHEN undefined_table THEN
    -- pg_cron not installed in this environment
    NULL;
END $$;

DROP FUNCTION IF EXISTS fn_auto_fill_time_entries();
