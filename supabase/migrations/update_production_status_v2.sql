-- ============================================================================
-- MIGRATION: Update production status constraint V2
-- Adds new status phases: cancelled, rework_needed, on_cutting_process,
-- on_polishing_process, on_banding_oven, waiting_to_cnc_wjet,
-- waiting_to_drill, waiting_to_paint_cabin
-- ============================================================================

-- Drop existing constraint
ALTER TABLE productions DROP CONSTRAINT IF EXISTS productions_status_check;

DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'productions'::regclass
        AND contype = 'c'
        AND (conname LIKE '%status%' OR conname = 'productions_status_check')
    LOOP
        EXECUTE format('ALTER TABLE productions DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
    END LOOP;
END $$;

-- Add updated constraint with all valid status values
ALTER TABLE productions
ADD CONSTRAINT productions_status_check CHECK (
    status IN (
        -- Red group
        'not_authorized',
        'cancelled',
        'rework_needed',
        -- Green (entry)
        'authorized',
        -- Orange group (active processes)
        'on_cutting_process',
        'on_polishing_process',
        'on_paint_cabin',
        'on_laminating_machine',
        'on_schmelz_oven',
        'on_banding_oven',
        'tempering_in_progress',
        -- Yellow group (waiting)
        'waiting_to_cnc_wjet',
        'waiting_to_drill',
        'waiting_to_paint_cabin',
        'waiting_for_schmelz',
        'waiting_for_tempering',
        'waiting_for_packing',
        -- Blue group
        'packed',
        'ready_for_dispatch',
        -- Green (exit)
        'delivered',
        'completed',
        -- Old status values for backward compatibility
        'cutting',
        'polishing',
        'tempered',
        'on_cabin',
        'laminating',
        'laminated',
        'on_oven'
    )
);
