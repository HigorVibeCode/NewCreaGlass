-- ============================================================================
-- MIGRATION: Update production_items constraints for glass_type, structure_type, paint_type
-- Adds all glass types currently used by the app (lavabo, client_service, etc.)
-- Also updates structure_type and paint_type constraints to match the app
-- ============================================================================

-- 1. Drop existing glass_type constraint(s)
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'production_items'::regclass
        AND contype = 'c'
        AND conname LIKE '%glass_type%'
    LOOP
        EXECUTE format('ALTER TABLE production_items DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
        RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
    END LOOP;
END $$;

-- 2. Add updated glass_type constraint with ALL valid values
ALTER TABLE production_items
ADD CONSTRAINT production_items_glass_type_check CHECK (
    glass_type IN (
        -- Original types
        'tempered',
        'strengthened',
        'float',
        'laminated',
        'textured',
        'sandblasted',
        'cuted',
        'insulated',
        -- New types
        'lavabo',
        'client_service',
        'polish_only',
        'cutting_only',
        'schmelzglas_only',
        'float_esg',
        'schmelzglas_tvg',
        'float_tvg'
    )
);

-- 3. Drop existing structure_type constraint(s) if they exist
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'production_items'::regclass
        AND contype = 'c'
        AND conname LIKE '%structure_type%'
    LOOP
        EXECUTE format('ALTER TABLE production_items DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
        RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
    END LOOP;
END $$;

-- 4. Add updated structure_type constraint
ALTER TABLE production_items
ADD CONSTRAINT production_items_structure_type_check CHECK (
    structure_type IN (
        'none',
        'linear',
        'abstract',
        'organic',
        'check_project'
    )
);

-- 5. Drop existing paint_type constraint(s) if they exist
DO $$
DECLARE
    constraint_record RECORD;
BEGIN
    FOR constraint_record IN
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'production_items'::regclass
        AND contype = 'c'
        AND conname LIKE '%paint_type%'
    LOOP
        EXECUTE format('ALTER TABLE production_items DROP CONSTRAINT IF EXISTS %I', constraint_record.conname);
        RAISE NOTICE 'Dropped constraint: %', constraint_record.conname;
    END LOOP;
END $$;

-- 6. Add updated paint_type constraint
ALTER TABLE production_items
ADD CONSTRAINT production_items_paint_type_check CHECK (
    paint_type IN (
        'none',
        'solid',
        'gradient',
        'printed',
        'satiniert',
        'check_project'
    )
);
