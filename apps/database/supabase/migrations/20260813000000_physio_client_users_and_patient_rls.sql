-- ─────────────────────────────────────────────────────────────────────────────
-- physio_client_users: links a physio_client to an auth.users account
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS physio_client_users (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  physio_client_id uuid        NOT NULL UNIQUE REFERENCES physio_clients(id) ON DELETE CASCADE,
  auth_user_id     uuid        NOT NULL UNIQUE REFERENCES auth.users(id)     ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE physio_client_users ENABLE ROW LEVEL SECURITY;

-- Patient reads their own link row
CREATE POLICY pcu_self_read ON physio_client_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- Fisio owner reads all patient links in their business
CREATE POLICY pcu_business_read ON physio_client_users
  FOR SELECT TO authenticated
  USING (
    physio_client_id IN (
      SELECT id FROM physio_clients
      WHERE business_id IN (
        SELECT business_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

GRANT SELECT ON physio_client_users TO authenticated;
GRANT ALL    ON physio_client_users TO service_role;

CREATE INDEX IF NOT EXISTS physio_client_users_client_idx
  ON physio_client_users(physio_client_id);

CREATE INDEX IF NOT EXISTS physio_client_users_user_idx
  ON physio_client_users(auth_user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: find an auth.users row by email (called from service_role only)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_auth_user_id_by_email(p_email text)
RETURNS uuid LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;

REVOKE ALL ON FUNCTION get_auth_user_id_by_email FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION get_auth_user_id_by_email TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- Patient SELECT policies for the 5 clinical tables
-- Each adds a second USING path so RLS passes if the row belongs to the
-- authenticated patient (existing business policies are untouched).
-- ─────────────────────────────────────────────────────────────────────────────

-- physio_routines
CREATE POLICY physio_routines_patient_read ON physio_routines
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT physio_client_id FROM physio_client_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- pathologies
CREATE POLICY pathologies_patient_read ON pathologies
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT physio_client_id FROM physio_client_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- pain_map
CREATE POLICY pain_map_patient_read ON pain_map
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT physio_client_id FROM physio_client_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- patient_measurements
CREATE POLICY patient_measurements_patient_read ON patient_measurements
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT physio_client_id FROM physio_client_users
      WHERE auth_user_id = auth.uid()
    )
  );

-- patient_goals
CREATE POLICY patient_goals_patient_read ON patient_goals
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT physio_client_id FROM physio_client_users
      WHERE auth_user_id = auth.uid()
    )
  );
