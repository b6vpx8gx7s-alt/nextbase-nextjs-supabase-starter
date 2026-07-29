-- Make employee_id nullable in nutrition_plans.
-- The creator of a plan is the business owner (identified by business_id),
-- not necessarily an employee row in the employees table.

-- 1. Drop FK constraint to employees if it exists (name may vary)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT constraint_name
    FROM information_schema.table_constraints
    WHERE table_name = 'nutrition_plans'
      AND constraint_type = 'FOREIGN KEY'
      AND constraint_name ILIKE '%employee%'
  LOOP
    EXECUTE format('ALTER TABLE nutrition_plans DROP CONSTRAINT %I', r.constraint_name);
  END LOOP;
END;
$$;

-- 2. Allow NULL values for employee_id
ALTER TABLE nutrition_plans
  ALTER COLUMN employee_id DROP NOT NULL;
