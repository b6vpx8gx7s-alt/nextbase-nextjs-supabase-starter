-- Fix nutrition RLS policies: replace current_setting('app.current_business_id')
-- with auth.uid() subquery so the API works without setting session variables.

DROP POLICY IF EXISTS "businesses_manage_nutrition_plans" ON nutrition_plans;
DROP POLICY IF EXISTS "businesses_read_nutrition_meals"   ON nutrition_plan_meals;
DROP POLICY IF EXISTS "businesses_write_nutrition_meals"  ON nutrition_plan_meals;
DROP POLICY IF EXISTS "businesses_update_nutrition_meals" ON nutrition_plan_meals;
DROP POLICY IF EXISTS "businesses_delete_nutrition_meals" ON nutrition_plan_meals;

-- nutrition_plans: single all-operations policy via profiles subquery
CREATE POLICY "users_manage_own_business_nutrition_plans"
  ON nutrition_plans
  USING (
    business_id IN (
      SELECT business_id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- nutrition_plan_meals: four per-operation policies

CREATE POLICY "users_read_nutrition_meals"
  ON nutrition_plan_meals
  FOR SELECT
  USING (
    plan_id IN (
      SELECT id FROM nutrition_plans
      WHERE business_id IN (
        SELECT business_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "users_write_nutrition_meals"
  ON nutrition_plan_meals
  FOR INSERT
  WITH CHECK (
    plan_id IN (
      SELECT id FROM nutrition_plans
      WHERE business_id IN (
        SELECT business_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "users_update_nutrition_meals"
  ON nutrition_plan_meals
  FOR UPDATE
  USING (
    plan_id IN (
      SELECT id FROM nutrition_plans
      WHERE business_id IN (
        SELECT business_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "users_delete_nutrition_meals"
  ON nutrition_plan_meals
  FOR DELETE
  USING (
    plan_id IN (
      SELECT id FROM nutrition_plans
      WHERE business_id IN (
        SELECT business_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );
