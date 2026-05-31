-- Add thumbnail_path to manuals for card thumbnail image
ALTER TABLE manuals
ADD COLUMN IF NOT EXISTS thumbnail_path VARCHAR(512) NULL;

COMMENT ON COLUMN manuals.thumbnail_path IS 'Storage path (filename in documents bucket) for the manual card thumbnail';
