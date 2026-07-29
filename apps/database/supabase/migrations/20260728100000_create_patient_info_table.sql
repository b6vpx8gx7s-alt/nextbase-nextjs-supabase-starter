-- patient_info: one-to-one with nutrition_plans, stores clinical context for the patient
CREATE TABLE IF NOT EXISTS patient_info (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id          UUID NOT NULL REFERENCES nutrition_plans(id) ON DELETE CASCADE,
  age              INTEGER,
  weight_kg        DECIMAL(5, 2),
  height_cm        DECIMAL(5, 2),
  objective        TEXT,
  restrictions     TEXT[],
  allergies        TEXT,
  medical_conditions TEXT,
  activity_level     TEXT,
  nutritional_status TEXT,
  medications        TEXT[],
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (plan_id)
);

ALTER TABLE patient_info ENABLE ROW LEVEL SECURITY;

-- Access governed by the parent plan's business_id
CREATE POLICY "patient_info_access_via_plan"
  ON patient_info
  USING (
    plan_id IN (
      SELECT np.id FROM nutrition_plans np
      INNER JOIN profiles p ON p.business_id = np.business_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    plan_id IN (
      SELECT np.id FROM nutrition_plans np
      INNER JOIN profiles p ON p.business_id = np.business_id
      WHERE p.user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE patient_info TO authenticated;
GRANT ALL ON TABLE patient_info TO service_role;
