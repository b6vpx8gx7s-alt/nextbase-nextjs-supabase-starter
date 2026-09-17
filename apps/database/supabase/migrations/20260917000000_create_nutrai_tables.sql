CREATE TABLE IF NOT EXISTS nutrai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid,
  user_id uuid,
  category text,
  title text,
  messages jsonb[],
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS nutrai_tool_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL,
  user_id uuid NOT NULL,
  tool_name text NOT NULL,
  category text NOT NULL,
  user_role text NOT NULL,
  params jsonb,
  result_size int,
  executed_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nutrai_tool_logs_business
  ON nutrai_tool_logs(business_id, executed_at DESC);
