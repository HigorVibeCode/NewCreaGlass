-- ============================================================
-- Migration: Push 24h antes (Events + Work Orders)
--
-- Cria função + cron para inserir notificações automáticas
-- exatamente 24h antes do horário agendado.
-- O webhook de INSERT em notifications enviará o push.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Função principal de lembretes 24h
CREATE OR REPLACE FUNCTION fn_send_24h_event_workorder_reminders()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  local_now timestamp;
  target_start timestamp;
  target_end timestamp;
BEGIN
  -- Considerar agenda local (Suíça) para date/time sem timezone
  local_now := timezone('Europe/Zurich', now());
  target_start := local_now + interval '24 hours';
  target_end := local_now + interval '24 hours 15 minutes';

  -- =========================
  -- Events (24h antes)
  -- =========================
  INSERT INTO notifications (type, payload_json, created_by_system, target_user_id)
  SELECT
    'event.reminder24h',
    jsonb_build_object(
      'eventId', e.id,
      'title', e.title,
      'startDate', e.start_date,
      'startTime', e.start_time,
      'reminderLabel', format('Tomorrow %sh - %s', to_char(e.start_time, 'FMHH24:MI'), e.title),
      'deepLink', format('/event-detail?eventId=%s', e.id)
    ),
    true,
    NULL
  FROM events e
  WHERE e.start_date IS NOT NULL
    AND e.start_time IS NOT NULL
    AND coalesce(e.status, 'active') != 'completed'
    AND (e.start_date::timestamp + e.start_time) >= target_start
    AND (e.start_date::timestamp + e.start_time) < target_end
    AND NOT EXISTS (
      SELECT 1
      FROM notifications n
      WHERE n.type = 'event.reminder24h'
        AND n.payload_json->>'eventId' = e.id::text
    );

  -- =========================
  -- Work Orders (24h antes)
  -- =========================
  INSERT INTO notifications (type, payload_json, created_by_system, target_user_id)
  SELECT
    'workOrder.reminder24h',
    jsonb_build_object(
      'workOrderId', wo.id,
      'clientName', wo.client_name,
      'scheduledDate', wo.scheduled_date,
      'scheduledTime', wo.scheduled_time,
      'reminderLabel', format('Tomorrow %sh - %s', to_char(wo.scheduled_time, 'FMHH24:MI'), wo.client_name),
      'deepLink', format('/work-order-detail?workOrderId=%s', wo.id)
    ),
    true,
    NULL
  FROM work_orders wo
  WHERE wo.scheduled_date IS NOT NULL
    AND wo.scheduled_time IS NOT NULL
    AND wo.status NOT IN ('completed', 'cancelled')
    AND (wo.scheduled_date::timestamp + wo.scheduled_time) >= target_start
    AND (wo.scheduled_date::timestamp + wo.scheduled_time) < target_end
    AND NOT EXISTS (
      SELECT 1
      FROM notifications n
      WHERE n.type = 'workOrder.reminder24h'
        AND n.payload_json->>'workOrderId' = wo.id::text
    );
END;
$$;

-- Reagendar job com segurança
DO $$
BEGIN
  PERFORM cron.unschedule('events-workorders-24h-reminder');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- A cada 15 minutos: garante janela de 24h com boa precisão
SELECT cron.schedule(
  'events-workorders-24h-reminder',
  '*/15 * * * *',
  $$SELECT fn_send_24h_event_workorder_reminders()$$
);

