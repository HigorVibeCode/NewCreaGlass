-- Add cover_image_path to maintenance_records for Basic Information card cover image
ALTER TABLE maintenance_records
ADD COLUMN IF NOT EXISTS cover_image_path VARCHAR(512) NULL;

COMMENT ON COLUMN maintenance_records.cover_image_path IS 'Storage path (filename in documents bucket) for the cover image of the Basic Information card';
