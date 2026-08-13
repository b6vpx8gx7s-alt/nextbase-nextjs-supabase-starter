-- Extend the businesses.category CHECK to include 'fisioterapia'
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_category_check;

ALTER TABLE businesses ADD CONSTRAINT businesses_category_check
  CHECK (category IN ('tatuaje', 'barberia', 'spa', 'nutricion', 'fisioterapia', 'otro'));
