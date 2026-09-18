CREATE TABLE IF NOT EXISTS nutrition_food_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  categoria text,
  calorias numeric,
  proteina numeric,
  carbohidratos numeric,
  grasa numeric,
  unidad text DEFAULT 'g',
  fuente text NOT NULL DEFAULT 'personalizado',
  fdc_id integer,
  business_id uuid NOT NULL,
  created_by uuid,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_nutrition_food_suggestions_status
ON nutrition_food_suggestions(status);

CREATE INDEX IF NOT EXISTS idx_nutrition_food_suggestions_business_id
ON nutrition_food_suggestions(business_id);
