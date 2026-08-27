-- ── gym_workout_sessions ─────────────────────────────────────────────────────
-- One row per training day: anchors all set logs for that session.

CREATE TABLE IF NOT EXISTS gym_workout_sessions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES businesses(id)   ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES gym_clients(id)  ON DELETE CASCADE,
  routine_id   uuid        NOT NULL REFERENCES gym_routines(id) ON DELETE CASCADE,
  dia_index    smallint    NOT NULL,
  trained_at   date        NOT NULL DEFAULT CURRENT_DATE,
  notas        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gym_workout_sessions_unique
    UNIQUE (client_id, routine_id, dia_index, trained_at)
);

ALTER TABLE gym_workout_sessions ENABLE ROW LEVEL SECURITY;

-- Trainer: full access to sessions in their business
CREATE POLICY gym_workout_sessions_trainer ON gym_workout_sessions
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

-- Client: insert own sessions
CREATE POLICY gym_workout_sessions_client_insert ON gym_workout_sessions
  FOR INSERT TO authenticated
  WITH CHECK (client_id IN (
    SELECT gym_client_id FROM gym_client_users WHERE auth_user_id = auth.uid()
  ));

-- Client: read own sessions
CREATE POLICY gym_workout_sessions_client_read ON gym_workout_sessions
  FOR SELECT TO authenticated
  USING (client_id IN (
    SELECT gym_client_id FROM gym_client_users WHERE auth_user_id = auth.uid()
  ));

GRANT ALL ON TABLE gym_workout_sessions TO authenticated;
GRANT ALL ON TABLE gym_workout_sessions TO service_role;


-- ── gym_set_logs ──────────────────────────────────────────────────────────────
-- One row per completed set. reps_o_seg holds reps or seconds (isometric).
-- UNIQUE per (session, exercise, set_num) so POST is safely idempotent (upsert).

CREATE TABLE IF NOT EXISTS gym_set_logs (
  id           uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   uuid         NOT NULL REFERENCES gym_workout_sessions(id) ON DELETE CASCADE,
  exercise_id  uuid         NOT NULL REFERENCES exercises(id),
  set_num      smallint     NOT NULL CHECK (set_num >= 1),
  reps_o_seg   integer      NOT NULL CHECK (reps_o_seg >= 0),
  peso_kg      numeric(6,2)          CHECK (peso_kg >= 0),
  created_at   timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT gym_set_logs_unique
    UNIQUE (session_id, exercise_id, set_num)
);

ALTER TABLE gym_set_logs ENABLE ROW LEVEL SECURITY;

-- Trainer: read set logs for sessions in their business
CREATE POLICY gym_set_logs_trainer ON gym_set_logs
  FOR SELECT
  USING (session_id IN (
    SELECT id FROM gym_workout_sessions
    WHERE business_id IN (
      SELECT business_id FROM profiles WHERE user_id = auth.uid()
    )
  ));

-- Client: insert set logs into their own sessions
CREATE POLICY gym_set_logs_client_insert ON gym_set_logs
  FOR INSERT TO authenticated
  WITH CHECK (session_id IN (
    SELECT id FROM gym_workout_sessions
    WHERE client_id IN (
      SELECT gym_client_id FROM gym_client_users WHERE auth_user_id = auth.uid()
    )
  ));

-- Client: read their own set logs
CREATE POLICY gym_set_logs_client_read ON gym_set_logs
  FOR SELECT TO authenticated
  USING (session_id IN (
    SELECT id FROM gym_workout_sessions
    WHERE client_id IN (
      SELECT gym_client_id FROM gym_client_users WHERE auth_user_id = auth.uid()
    )
  ));

GRANT ALL ON TABLE gym_set_logs TO authenticated;
GRANT ALL ON TABLE gym_set_logs TO service_role;
