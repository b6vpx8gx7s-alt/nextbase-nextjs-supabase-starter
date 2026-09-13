CREATE TABLE IF NOT EXISTS exercise_restriction_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES exercises(id),
  exercise_nombre text NOT NULL,
  zona_corporal text NOT NULL,
  severidad text NOT NULL CHECK (severidad IN ('forbidden', 'caution')),
  motivo text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_exercise_restriction_suggestions_status
ON exercise_restriction_suggestions(status);
