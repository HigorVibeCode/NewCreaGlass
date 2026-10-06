-- ============================================================
-- Migration: Adicionar coluna preferred_language à tabela users
--
-- Armazena o idioma preferido do usuário para que as notificações
-- push sejam enviadas no idioma correto.
-- Valores possíveis: 'en', 'de', 'fr', 'it', 'pt', 'es'
-- Default: 'en'
-- ============================================================

ALTER TABLE users
ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(5) DEFAULT 'en';
