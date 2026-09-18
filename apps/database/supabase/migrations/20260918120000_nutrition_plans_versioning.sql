ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS parent_plan_id uuid REFERENCES nutrition_plans(id);
ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- Verify
SELECT column_name FROM information_schema.columns
WHERE table_name = 'nutrition_plans'
  AND column_name IN ('parent_plan_id', 'version');
