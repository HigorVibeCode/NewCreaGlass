-- Production phases v2: sandblasting, inspection and packaging phases
-- Safe to run more than once. Works whether productions.status is a text
-- column with a CHECK constraint or a Postgres ENUM type.
-- Text columns: the status CHECK constraint is removed (the app owns the list),
-- so existing rows with older statuses can still be edited.

DO $$
DECLARE
  statuses TEXT[] := ARRAY[
    'not_authorized', 'authorized', 'cutting', 'polishing',
    'awaiting_film', 'awaiting_workart', 'burn_paper', 'waiting_for_sandblasting',
    'sandblasting', 'awaiting_oil_application', 'awaiting_oil_drying',
    'waiting_for_tempering', 'on_oven', 'tempered',
    'on_cabin', 'laminating', 'laminated',
    'awaiting_inspection', 'inspected',
    'pack_glass_box', 'pack_pallet', 'pack_paper', 'waiting_for_packing', 'packed',
    'ready_for_dispatch', 'delivered', 'completed', 'cancelled'
  ];
  tbl TEXT;
  col TEXT;
  enum_type TEXT;
  con RECORD;
  s TEXT;
BEGIN
  FOR tbl, col IN
    SELECT * FROM (VALUES
      ('productions', 'status'),
      ('production_status_history', 'previous_status'),
      ('production_status_history', 'new_status')
    ) AS t(tbl, col)
  LOOP
    -- Skip tables/columns that don't exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = tbl AND column_name = col
    ) THEN
      CONTINUE;
    END IF;

    -- ENUM column: add any missing values
    SELECT c.udt_name INTO enum_type
    FROM information_schema.columns c
    JOIN pg_type pt ON pt.typname = c.udt_name AND pt.typtype = 'e'
    WHERE c.table_schema = 'public' AND c.table_name = tbl AND c.column_name = col;

    IF enum_type IS NOT NULL THEN
      FOREACH s IN ARRAY statuses LOOP
        EXECUTE format('ALTER TYPE %I ADD VALUE IF NOT EXISTS %L', enum_type, s);
      END LOOP;
    END IF;

    -- Text column: drop CHECK constraints that restrict this column
    FOR con IN
      SELECT pc.conname
      FROM pg_constraint pc
      JOIN pg_class rel ON rel.oid = pc.conrelid
      JOIN pg_namespace ns ON ns.oid = rel.relnamespace
      WHERE ns.nspname = 'public'
        AND rel.relname = tbl
        AND pc.contype = 'c'
        AND pg_get_constraintdef(pc.oid) ILIKE '%' || col || '%'
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', tbl, con.conname);
    END LOOP;
  END LOOP;

END $$;
