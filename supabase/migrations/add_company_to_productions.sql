-- Add company column to productions (3S | Crea Glass)
ALTER TABLE productions
ADD COLUMN IF NOT EXISTS company TEXT;

COMMENT ON COLUMN productions.company IS 'Company: 3S or Crea Glass';
