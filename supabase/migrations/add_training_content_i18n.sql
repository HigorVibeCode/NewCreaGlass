-- Tradução do conteúdo (título e descrição) dos treinamentos - inicialmente para onboarding
ALTER TABLE trainings
ADD COLUMN IF NOT EXISTS title_i18n JSONB NULL,
ADD COLUMN IF NOT EXISTS description_i18n JSONB NULL;

COMMENT ON COLUMN trainings.title_i18n IS 'Traduções do título por locale, ex: {"en": "Title", "es": "Título"}';
COMMENT ON COLUMN trainings.description_i18n IS 'Traduções da descrição por locale';
