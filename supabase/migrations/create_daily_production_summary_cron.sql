-- ============================================================
-- Migration: Notificação Push Diária - Resumo do Painel de Produção
-- 
-- Cria uma função SQL e um job pg_cron que envia automaticamente
-- uma notificação push com o resumo diário do painel de produção.
--
-- Frequência: Segunda a Sexta, 07:30 (Europe/Zurich)
-- Mensagem: "Bom dia, hoje temos X pedidos no painel de produção."
-- ============================================================

-- 1. Habilitar extensões necessárias (caso ainda não estejam habilitadas)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Criar a função que conta os pedidos ativos e insere a notificação
CREATE OR REPLACE FUNCTION fn_daily_production_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  total_orders INT;
BEGIN
  -- Contar pedidos nas fases ativas do painel de produção
  SELECT COUNT(*) INTO total_orders
  FROM productions
  WHERE status IN (
    -- Verde (entrada): Authorized
    'authorized',
    -- Laranja (processos ativos)
    'on_cutting_process',
    'on_polishing_process',
    'on_paint_cabin',
    'on_laminating_machine',
    'on_schmelz_oven',
    'on_banding_oven',
    'tempering_in_progress',
    -- Amarelo (aguardando)
    'waiting_to_cnc_wjet',
    'waiting_to_drill',
    'waiting_to_paint_cabin',
    'waiting_for_schmelz',
    'waiting_for_tempering',
    'waiting_for_packing'
  );

  -- Inserir notificação global (target_user_id = NULL → todos os usuários)
  -- O webhook no INSERT da tabela notifications disparará automaticamente
  -- a Edge Function send-push-on-notification para enviar o push.
  INSERT INTO notifications (type, payload_json, created_by_system, target_user_id)
  VALUES (
    'production.dailySummary',
    jsonb_build_object('totalOrders', total_orders),
    true,
    NULL
  );
END;
$$;

-- 3. Agendar o job pg_cron: Segunda a Sexta às 06:30 UTC = 07:30 CET (Suíça, horário de inverno)
-- Nota: pg_cron roda em UTC. Durante o horário de verão (CEST, UTC+2, ~março-outubro),
-- a notificação chegará às 08:30 local. Para ajustar no verão, altere para '30 5 * * 1-5'.
-- Cron: minuto 30, hora 6, qualquer dia, qualquer mês, segunda a sexta (1-5)
SELECT cron.schedule(
  'daily-production-summary',
  '30 6 * * 1-5',
  $$SELECT fn_daily_production_summary()$$
);
