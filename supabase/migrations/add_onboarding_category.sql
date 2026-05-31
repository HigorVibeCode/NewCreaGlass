-- ============================================================================
-- MIGRATION: Add Onboarding Category to Trainings
-- ============================================================================
-- Adiciona a categoria 'onboarding' ao sistema de treinamentos
-- ============================================================================

-- Remove o constraint antigo
ALTER TABLE trainings DROP CONSTRAINT IF EXISTS trainings_category_check;

-- Adiciona o novo constraint com onboarding
ALTER TABLE trainings ADD CONSTRAINT trainings_category_check 
  CHECK (category IN ('mandatory', 'professional', 'onboarding'));
