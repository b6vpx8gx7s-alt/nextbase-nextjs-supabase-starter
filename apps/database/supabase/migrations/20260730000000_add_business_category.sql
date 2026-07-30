-- Add category column to businesses table
-- Categories: tatuaje, barberia, spa, nutricion, otro

ALTER TABLE businesses
ADD COLUMN IF NOT EXISTS category text
CHECK (category IN ('tatuaje', 'barberia', 'spa', 'nutricion', 'otro'));
