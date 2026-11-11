-- La tabla gym_measurements fue creada en producción con el esquema antiguo
-- (columnas planas: weight_kg, height_cm). Se elimina y se recrea con el
-- esquema normalizado (measurement_type + value) requerido por el app.
-- No hay datos valiosos que preservar ya que el esquema antiguo era incompatible.

DROP TABLE IF EXISTS gym_measurements CASCADE;

CREATE TABLE gym_measurements (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id        uuid        NOT NULL REFERENCES gym_clients(id) ON DELETE CASCADE,
  measurement_type text        NOT NULL REFERENCES measurement_types(code),
  value            numeric     NOT NULL,
  unit             text,
  measured_at      date        NOT NULL DEFAULT CURRENT_DATE,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_measurements_business_access ON gym_measurements
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY gym_measurements_client_read ON gym_measurements
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT gym_client_id FROM gym_client_users
      WHERE auth_user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE gym_measurements TO authenticated;
GRANT ALL ON TABLE gym_measurements TO service_role;

CREATE INDEX gym_measurements_client_id_idx   ON gym_measurements(client_id);
CREATE INDEX gym_measurements_business_id_idx ON gym_measurements(business_id);
CREATE INDEX gym_measurements_type_idx        ON gym_measurements(measurement_type);
CREATE INDEX gym_measurements_measured_at_idx ON gym_measurements(measured_at);
