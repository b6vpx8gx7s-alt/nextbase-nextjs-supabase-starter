-- The original physio_clients table had English column names (name, phone)
-- created before the Spanish-column migration. `name` is NOT NULL with no
-- default, which blocks every INSERT that uses the new `nombre` column.
-- Make the legacy columns nullable so they don't interfere.

ALTER TABLE physio_clients
  ALTER COLUMN name DROP NOT NULL,
  ALTER COLUMN phone DROP NOT NULL;
