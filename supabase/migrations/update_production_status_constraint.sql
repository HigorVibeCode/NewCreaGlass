-- Update production status constraint to include new status values
-- This migration updates the CHECK constraint on the status column
-- to allow the new production status values

-- Drop the existing constraint if it exists (by name)
ALTER TABLE productions DROP CONSTRAINT IF EXISTS productions_status_check;

-- Also try to drop any other status-related constraints
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    -- Find all CHECK constraints on the productions table that might be related to status
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'productions'::regclass
        AND contype = 'c'
        AND (
            conname LIKE '%status%' 
            OR conname = 'productions_status_check'
        )
    LOOP
        EXECUTE format('ALTER TABLE productions DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
END $$;

-- Add new constraint with all valid status values (new and old for compatibility)
ALTER TABLE productions
ADD CONSTRAINT productions_status_check CHECK (
    status IN (
        'not_authorized',
        'authorized',
        'cutting',
        'polishing',
        'on_paint_cabin',
        'on_laminating_machine',
        'on_schmelz_oven',
        'waiting_for_tempering',
        'waiting_for_schmelz',
        'tempering_in_progress',
        'tempered',
        'waiting_for_packing',
        'packed',
        'ready_for_dispatch',
        'delivered',
        'completed',
        -- Old status values for backward compatibility
        'on_cabin',
        'laminating',
        'laminated',
        'on_oven'
    )
);
