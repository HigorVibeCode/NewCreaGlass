-- Update events table to add new fields: type, start_date, end_date, start_time, end_time, location, people
-- This migration adds the fields needed for the complete event management system

-- Add new columns to events table if they don't exist
ALTER TABLE events 
  ADD COLUMN IF NOT EXISTS type VARCHAR(50) DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS start_date DATE,
  ADD COLUMN IF NOT EXISTS end_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS people TEXT DEFAULT '';

-- If people column already exists as UUID[], drop and recreate as TEXT
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'events' 
    AND column_name = 'people' 
    AND data_type = 'ARRAY'
  ) THEN
    ALTER TABLE events DROP COLUMN people;
    ALTER TABLE events ADD COLUMN people TEXT DEFAULT '';
  END IF;
END $$;

-- Create index for type filtering
CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);

-- Create index for date range queries
CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(end_date);
