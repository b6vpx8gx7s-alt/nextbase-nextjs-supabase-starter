-- Add optional trainer/client note per set log.
-- Backward compatible: existing rows get NULL (no note).
ALTER TABLE gym_set_logs
  ADD COLUMN IF NOT EXISTS nota text;
