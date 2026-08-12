ALTER TABLE physio_clients
  ADD COLUMN IF NOT EXISTS roda_customer_id uuid
    REFERENCES customers(id) ON DELETE SET NULL;
