ALTER TABLE exercises
  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('private', 'public')),
  ADD COLUMN IF NOT EXISTS suggested_for_public boolean NOT NULL DEFAULT false;

-- Reemplazar política permisiva por una que filtra por visibilidad o negocio
DROP POLICY IF EXISTS exercises_read ON exercises;
CREATE POLICY exercises_read ON exercises
  FOR SELECT TO authenticated
  USING (
    visibility = 'public'
    OR business_id IN (
      SELECT business_id FROM profiles WHERE user_id = auth.uid()
    )
  );
