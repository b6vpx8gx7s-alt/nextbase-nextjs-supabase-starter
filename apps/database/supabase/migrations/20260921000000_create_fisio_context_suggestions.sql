CREATE TABLE IF NOT EXISTS fisio_context_suggestions (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  exercise_id  uuid        NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  exercise_nombre text     NOT NULL,
  grupo_muscular  text,
  patron          text,
  motivo          text,
  status          text     NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected', 'no_match')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

CREATE INDEX IF NOT EXISTS fisio_context_suggestions_status_idx      ON fisio_context_suggestions(status);
CREATE INDEX IF NOT EXISTS fisio_context_suggestions_exercise_id_idx ON fisio_context_suggestions(exercise_id);
