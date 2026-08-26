-- ─────────────────────────────────────────────────────────────────────────────
-- business_services: permite que un negocio tenga múltiples apps RODA activas
-- simultáneamente. Solo las combinaciones gym+nutricion son válidas.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE business_services (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service     TEXT        NOT NULL CHECK (service IN ('gym', 'nutricion')),
  created_at  timestamptz DEFAULT now(),
  UNIQUE(business_id, service)
);

ALTER TABLE business_services ENABLE ROW LEVEL SECURITY;

-- Dueño del negocio puede leer sus propios servicios activos
CREATE POLICY bs_owner_read ON business_services
  FOR SELECT TO authenticated
  USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE user_id = auth.uid()
    )
  );

GRANT SELECT ON business_services TO authenticated;
GRANT ALL    ON business_services TO service_role;

CREATE INDEX IF NOT EXISTS business_services_business_idx
  ON business_services(business_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Poblar con negocios existentes que ya tienen category = 'gym' o 'nutricion'
-- ON CONFLICT DO NOTHING garantiza idempotencia si se vuelve a ejecutar
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO business_services (business_id, service)
SELECT id, category
FROM businesses
WHERE category IN ('gym', 'nutricion')
ON CONFLICT DO NOTHING;
