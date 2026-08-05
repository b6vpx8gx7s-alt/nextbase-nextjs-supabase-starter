-- physio_clients was created earlier with English column names (name, phone, etc.)
-- The 20260804 migration silently no-op'd via CREATE TABLE IF NOT EXISTS.
-- This adds the Spanish-named columns the app code actually uses.

ALTER TABLE physio_clients
  ADD COLUMN IF NOT EXISTS nombre           text,
  ADD COLUMN IF NOT EXISTS telefono         text,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento date,
  ADD COLUMN IF NOT EXISTS nivel_fisico     text NOT NULL DEFAULT 'principiante'
                                            CHECK (nivel_fisico IN ('principiante','intermedio','avanzado')),
  ADD COLUMN IF NOT EXISTS objetivo         text NOT NULL DEFAULT 'rehabilitacion',
  ADD COLUMN IF NOT EXISTS dias_disponibles integer[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS notas            text;
