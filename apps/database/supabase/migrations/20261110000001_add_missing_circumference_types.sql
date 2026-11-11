-- Agrega tipos de circunferencia que faltaban en el seed inicial
INSERT INTO measurement_types (code, label, unit_default, category, applies_to, min_value, max_value, description) VALUES
  ('circunferencia_cuello',    'Circunferencia de cuello',    'cm', 'antropometrico', 'ambos', NULL, NULL, NULL),
  ('circunferencia_hombro',    'Circunferencia de hombro',    'cm', 'antropometrico', 'ambos', NULL, NULL, NULL),
  ('circunferencia_pecho',     'Circunferencia de pecho',     'cm', 'antropometrico', 'ambos', NULL, NULL, NULL),
  ('circunferencia_antebrazo', 'Circunferencia de antebrazo', 'cm', 'antropometrico', 'ambos', NULL, NULL, NULL)
ON CONFLICT (code) DO NOTHING;
