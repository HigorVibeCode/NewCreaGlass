-- Add status column to events table
-- Default 'active' so all existing events remain active
ALTER TABLE events
  ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';

-- Add index for filtering by status
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
