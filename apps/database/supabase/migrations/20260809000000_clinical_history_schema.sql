-- ─────────────────────────────────────────────────────────────────────────────
-- Clinical history: measurement types catalogue, patient measurements, goals
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. measurement_types (global catalogue, no per-business RLS) ──────────────

CREATE TABLE IF NOT EXISTS measurement_types (
  code        text PRIMARY KEY,
  label       text NOT NULL,
  unit_default text,
  category    text CHECK (category IN ('antropometrico', 'escala_clinica', 'rom', 'composicion_corporal')),
  applies_to  text CHECK (applies_to IN ('fisioterapia', 'gym', 'ambos')),
  min_value   numeric,
  max_value   numeric,
  description text
);

-- All authenticated users can read the catalogue; no row-level restriction needed.
ALTER TABLE measurement_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY measurement_types_read_all ON measurement_types
  FOR SELECT
  TO authenticated
  USING (true);

GRANT SELECT ON TABLE measurement_types TO authenticated;
GRANT ALL    ON TABLE measurement_types TO service_role;


-- ── 2. patient_measurements ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_measurements (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id         uuid        NOT NULL REFERENCES physio_clients(id) ON DELETE CASCADE,
  measurement_type  text        NOT NULL REFERENCES measurement_types(code),
  value             numeric     NOT NULL,
  unit              text,
  measured_at       date        NOT NULL DEFAULT CURRENT_DATE,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE patient_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_measurements_business_access ON patient_measurements
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

GRANT ALL ON TABLE patient_measurements TO authenticated;
GRANT ALL ON TABLE patient_measurements TO service_role;

CREATE INDEX IF NOT EXISTS patient_measurements_client_id_idx  ON patient_measurements(client_id);
CREATE INDEX IF NOT EXISTS patient_measurements_business_id_idx ON patient_measurements(business_id);
CREATE INDEX IF NOT EXISTS patient_measurements_type_idx        ON patient_measurements(measurement_type);
CREATE INDEX IF NOT EXISTS patient_measurements_measured_at_idx ON patient_measurements(measured_at);


-- ── 3. patient_goals ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS patient_goals (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id       uuid        NOT NULL REFERENCES physio_clients(id) ON DELETE CASCADE,
  descripcion     text        NOT NULL,
  fecha_objetivo  date,
  estado          text        NOT NULL DEFAULT 'activo'
                              CHECK (estado IN ('activo', 'completado', 'pausado')),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE patient_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY patient_goals_business_access ON patient_goals
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

GRANT ALL ON TABLE patient_goals TO authenticated;
GRANT ALL ON TABLE patient_goals TO service_role;

CREATE INDEX IF NOT EXISTS patient_goals_client_id_idx  ON patient_goals(client_id);
CREATE INDEX IF NOT EXISTS patient_goals_business_id_idx ON patient_goals(business_id);


-- ── 4. Seed: measurement_types ───────────────────────────────────────────────

INSERT INTO measurement_types (code, label, unit_default, category, applies_to, min_value, max_value, description) VALUES

-- Antropométrico — ambos
('peso',                    'Peso corporal',             'kg',         'antropometrico',    'ambos',        NULL, NULL, NULL),
('altura',                  'Altura',                    'cm',         'antropometrico',    'ambos',        NULL, NULL, NULL),
('circunferencia_brazo',    'Circunferencia de brazo',   'cm',         'antropometrico',    'ambos',        NULL, NULL, NULL),
('circunferencia_muslo',    'Circunferencia de muslo',   'cm',         'antropometrico',    'ambos',        NULL, NULL, NULL),
('circunferencia_cintura',  'Circunferencia de cintura', 'cm',         'antropometrico',    'ambos',        NULL, NULL, NULL),
('circunferencia_cadera',   'Circunferencia de cadera',  'cm',         'antropometrico',    'ambos',        NULL, NULL, NULL),
('circunferencia_pantorrilla','Circunferencia de pantorrilla','cm',    'antropometrico',    'ambos',        NULL, NULL, NULL),

-- Escalas clínicas — fisioterapia
('eva_dolor',               'Escala EVA de dolor',       'puntos',     'escala_clinica',    'fisioterapia', 0,    10,   'Escala Visual Analógica: 0 = sin dolor, 10 = dolor máximo'),
('lysholm_rodilla',         'Lysholm Knee Score',        'puntos',     'escala_clinica',    'fisioterapia', 0,    100,  'Escala funcional para lesiones de rodilla'),
('oswestry_espalda',        'Índice de Oswestry',        'porcentaje', 'escala_clinica',    'fisioterapia', 0,    100,  'Índice de discapacidad por dolor lumbar'),
('dash_hombro',             'DASH (hombro/codo/mano)',   'puntos',     'escala_clinica',    'fisioterapia', 0,    100,  'Disabilities of the Arm, Shoulder and Hand'),
('berg_equilibrio',         'Escala de Berg',            'puntos',     'escala_clinica',    'fisioterapia', 0,    56,   'Balance Berg Scale para evaluación del equilibrio'),
('tug_segundos',            'Timed Up and Go (TUG)',     'segundos',   'escala_clinica',    'fisioterapia', NULL, NULL, 'Test funcional de movilidad y riesgo de caída'),
('fuerza_muscular_daniels', 'Fuerza muscular (Daniels)', 'puntos',     'escala_clinica',    'fisioterapia', 0,    5,    'Escala Daniels: 0 = sin contracción, 5 = fuerza normal'),

-- Rango de movimiento — fisioterapia
('rom_flexion_rodilla',     'ROM Flexión de rodilla',    'grados',     'rom',               'fisioterapia', NULL, NULL, NULL),
('rom_extension_rodilla',   'ROM Extensión de rodilla',  'grados',     'rom',               'fisioterapia', NULL, NULL, NULL),
('rom_flexion_hombro',      'ROM Flexión de hombro',     'grados',     'rom',               'fisioterapia', NULL, NULL, NULL),
('rom_abduccion_hombro',    'ROM Abducción de hombro',   'grados',     'rom',               'fisioterapia', NULL, NULL, NULL),

-- Composición corporal — gym
('porcentaje_grasa',        'Porcentaje de grasa',       'porcentaje', 'composicion_corporal','gym',        NULL, NULL, NULL),
('masa_muscular',           'Masa muscular',             'kg',         'composicion_corporal','gym',        NULL, NULL, NULL),
('imc',                     'Índice de masa corporal',   'kg/m2',      'composicion_corporal','ambos',      NULL, NULL, NULL),
('rm_sentadilla',           '1RM Sentadilla',            'kg',         'composicion_corporal','gym',        NULL, NULL, NULL),
('rm_press_banca',          '1RM Press de banca',        'kg',         'composicion_corporal','gym',        NULL, NULL, NULL),
('rm_peso_muerto',          '1RM Peso muerto',           'kg',         'composicion_corporal','gym',        NULL, NULL, NULL)

ON CONFLICT (code) DO NOTHING;
