-- Seed all required permissions into the permissions table.
-- Uses ON CONFLICT DO NOTHING so it is safe to run multiple times.
-- Run this in the Supabase SQL editor if permissions are missing.

-- Ensure a unique constraint exists on the key column (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'permissions_key_unique'
  ) THEN
    ALTER TABLE permissions ADD CONSTRAINT permissions_key_unique UNIQUE (key);
  END IF;
END $$;

INSERT INTO permissions (key, description_i18n_key) VALUES
  -- Documents
  ('documents.upload',  'permissions.documents.upload'),
  ('documents.create',  'permissions.documents.create'),
  ('documents.view',    'permissions.documents.view'),
  ('documents.download','permissions.documents.download'),
  ('documents.delete',  'permissions.documents.delete'),
  -- Inventory
  ('inventory.create',            'permissions.inventory.create'),
  ('inventory.update',            'permissions.inventory.update'),
  ('inventory.delete',            'permissions.inventory.delete'),
  ('inventory.group.create',      'permissions.inventory.group.create'),
  ('inventory.item.create',       'permissions.inventory.item.create'),
  ('inventory.item.update',       'permissions.inventory.item.update'),
  ('inventory.item.delete',       'permissions.inventory.item.delete'),
  ('inventory.item.adjustStock',  'permissions.inventory.item.adjustStock'),
  ('inventory.viewHistory',       'permissions.inventory.viewHistory'),
  -- Notifications
  ('notifications.view', 'permissions.notifications.view'),
  -- Blood Priority
  ('bloodPriority.view',        'permissions.bloodPriority.view'),
  ('bloodPriority.confirmRead', 'permissions.bloodPriority.confirmRead'),
  ('bloodPriority.create',      'permissions.bloodPriority.create'),
  -- Access Controls
  ('accessControls.view',              'permissions.accessControls.view'),
  ('accessControls.manageUsers',       'permissions.accessControls.manageUsers'),
  ('accessControls.managePermissions', 'permissions.accessControls.managePermissions'),
  -- Users
  ('users.activateDeactivate', 'permissions.users.activateDeactivate'),
  ('users.create',             'permissions.users.create'),
  -- QR / NFC
  ('qr.scan',  'permissions.qr.scan'),
  ('nfc.read',  'permissions.nfc.read'),
  -- Production
  ('production.create', 'permissions.production.create'),
  ('production.update', 'permissions.production.update'),
  ('production.delete', 'permissions.production.delete'),
  -- Events
  ('events.view',          'permissions.events.view'),
  ('events.create',        'permissions.events.create'),
  ('events.update',        'permissions.events.update'),
  ('events.delete',        'permissions.events.delete'),
  ('events.history',       'permissions.events.history'),
  ('events.report.create', 'permissions.events.report.create'),
  -- Work Orders (critical for non-master users to see work orders)
  ('workOrders.view',   'permissions.workOrders.view'),
  ('workOrders.create', 'permissions.workOrders.create'),
  ('workOrders.update', 'permissions.workOrders.update'),
  ('workOrders.delete', 'permissions.workOrders.delete')
ON CONFLICT (key) DO NOTHING;
