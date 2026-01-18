-- Create event_attachments table to store attachments (photos/PDFs) for events
-- Similar structure to production_attachments

CREATE TABLE IF NOT EXISTS event_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_event_attachments_event_id ON event_attachments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_attachments_created_at ON event_attachments(created_at);

-- Enable RLS
ALTER TABLE event_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view attachments for events they have permission to view
CREATE POLICY "Users can view event attachments"
  ON event_attachments
  FOR SELECT
  USING (
    -- Master users can view all
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
    OR
    -- Users with events.view permission can view
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'events.view'
    )
    OR
    -- Users can view attachments for events they created
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_attachments.event_id
      AND events.created_by = auth.uid()
    )
    OR
    -- Users can view attachments for events they are part of (people array)
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_attachments.event_id
      AND auth.uid() = ANY(events.people)
    )
  );

-- RLS Policy: Users can insert attachments for events they created or have events.create permission
CREATE POLICY "Users can insert event attachments"
  ON event_attachments
  FOR INSERT
  WITH CHECK (
    -- Master users can insert
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
    OR
    -- Users with events.create permission can insert
    EXISTS (
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON p.id = up.permission_id
      WHERE up.user_id = auth.uid()
      AND p.key = 'events.create'
      AND EXISTS (
        SELECT 1 FROM events
        WHERE events.id = event_attachments.event_id
        AND events.created_by = auth.uid()
      )
    )
  );

-- RLS Policy: Users can delete attachments for events they created
CREATE POLICY "Users can delete event attachments"
  ON event_attachments
  FOR DELETE
  USING (
    -- Master users can delete
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_type = 'Master'
      AND users.is_active = true
    )
    OR
    -- Users can delete attachments for events they created
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_attachments.event_id
      AND events.created_by = auth.uid()
    )
  );
