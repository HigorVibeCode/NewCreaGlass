-- Clients foundation + links to productions and work orders

CREATE TABLE IF NOT EXISTS clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  address TEXT,
  contact VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name);
CREATE INDEX IF NOT EXISTS idx_clients_is_active ON clients(is_active);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view clients" ON clients;
CREATE POLICY "Authenticated users can view clients"
  ON clients
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can insert clients" ON clients;
CREATE POLICY "Authenticated users can insert clients"
  ON clients
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can update clients" ON clients;
CREATE POLICY "Authenticated users can update clients"
  ON clients
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users can delete clients" ON clients;
CREATE POLICY "Authenticated users can delete clients"
  ON clients
  FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION update_clients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS clients_updated_at_trigger ON clients;
CREATE TRIGGER clients_updated_at_trigger
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_clients_updated_at();

-- Optional links for compatibility rollout
ALTER TABLE productions
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS linked_work_order_id UUID;

CREATE INDEX IF NOT EXISTS idx_productions_client_id ON productions(client_id);
CREATE INDEX IF NOT EXISTS idx_productions_linked_work_order_id ON productions(linked_work_order_id);

ALTER TABLE work_orders
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS production_order_id UUID REFERENCES productions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_work_orders_client_id ON work_orders(client_id);
CREATE INDEX IF NOT EXISTS idx_work_orders_production_order_id ON work_orders(production_order_id);

-- Backfill clients from legacy free text
INSERT INTO clients (name, created_by)
SELECT DISTINCT p.client_name, p.created_by
FROM productions p
WHERE p.client_name IS NOT NULL
  AND btrim(p.client_name) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM clients c
    WHERE lower(btrim(c.name)) = lower(btrim(p.client_name))
  );

INSERT INTO clients (name, address, contact, created_by)
SELECT DISTINCT w.client_name, w.client_address, w.client_contact, w.created_by
FROM work_orders w
WHERE w.client_name IS NOT NULL
  AND btrim(w.client_name) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM clients c
    WHERE lower(btrim(c.name)) = lower(btrim(w.client_name))
  );

UPDATE productions p
SET client_id = c.id
FROM clients c
WHERE p.client_id IS NULL
  AND p.client_name IS NOT NULL
  AND lower(btrim(c.name)) = lower(btrim(p.client_name));

UPDATE work_orders w
SET client_id = c.id
FROM clients c
WHERE w.client_id IS NULL
  AND w.client_name IS NOT NULL
  AND lower(btrim(c.name)) = lower(btrim(w.client_name));
