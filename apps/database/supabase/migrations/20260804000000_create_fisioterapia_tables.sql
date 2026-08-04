-- ============================================================
-- Fisioterapia — schema completo
-- Tablas: physio_clients, pathologies, pain_map,
--         exercises, exercise_zones, exercise_restrictions,
--         zone_aliases, physio_routines, physio_routine_exercises
-- ============================================================

-- ── 1. physio_clients ─────────────────────────────────────────
-- Pacientes de un negocio de fisioterapia.
CREATE TABLE IF NOT EXISTS physio_clients (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  nombre       text NOT NULL,
  email        text,
  telefono     text,
  fecha_nacimiento date,
  nivel_fisico text NOT NULL DEFAULT 'principiante'
                    CHECK (nivel_fisico IN ('principiante','intermedio','avanzado')),
  objetivo     text NOT NULL DEFAULT 'rehabilitacion',
  dias_disponibles integer[] NOT NULL DEFAULT '{}',
  notas        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE physio_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY physio_clients_business_access ON physio_clients
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

GRANT ALL ON TABLE physio_clients TO authenticated;
GRANT ALL ON TABLE physio_clients TO service_role;

CREATE INDEX IF NOT EXISTS physio_clients_business_id_idx ON physio_clients(business_id);


-- ── 2. pathologies ────────────────────────────────────────────
-- Patologías declaradas del paciente.
CREATE TABLE IF NOT EXISTS pathologies (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id        uuid NOT NULL REFERENCES physio_clients(id) ON DELETE CASCADE,
  nombre           text NOT NULL,
  zona_corporal    text NOT NULL,
  fecha_diagnostico date,
  notas            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pathologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY pathologies_business_access ON pathologies
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

GRANT ALL ON TABLE pathologies TO authenticated;
GRANT ALL ON TABLE pathologies TO service_role;

CREATE INDEX IF NOT EXISTS pathologies_client_id_idx    ON pathologies(client_id);
CREATE INDEX IF NOT EXISTS pathologies_business_id_idx  ON pathologies(business_id);


-- ── 3. pain_map ───────────────────────────────────────────────
-- Historial de zonas de dolor del paciente.
CREATE TABLE IF NOT EXISTS pain_map (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id     uuid NOT NULL REFERENCES physio_clients(id) ON DELETE CASCADE,
  zona_corporal text NOT NULL,
  mecanica      text NOT NULL,
  nivel         smallint NOT NULL CHECK (nivel BETWEEN 1 AND 10),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pain_map ENABLE ROW LEVEL SECURITY;

CREATE POLICY pain_map_business_access ON pain_map
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

GRANT ALL ON TABLE pain_map TO authenticated;
GRANT ALL ON TABLE pain_map TO service_role;

CREATE INDEX IF NOT EXISTS pain_map_client_id_idx   ON pain_map(client_id);
CREATE INDEX IF NOT EXISTS pain_map_business_id_idx ON pain_map(business_id);


-- ── 4. zone_aliases ───────────────────────────────────────────
-- Mapea strings del wizard a zonas canónicas.
CREATE TABLE IF NOT EXISTS zone_aliases (
  zona_usuario  text PRIMARY KEY,
  zona_canonica text NOT NULL
);

ALTER TABLE zone_aliases ENABLE ROW LEVEL SECURITY;

CREATE POLICY zone_aliases_read ON zone_aliases
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON TABLE zone_aliases TO authenticated;
GRANT ALL ON TABLE zone_aliases TO service_role;


-- ── 5. exercises ──────────────────────────────────────────────
-- Catálogo global de ejercicios.
CREATE TABLE IF NOT EXISTS exercises (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre            text NOT NULL UNIQUE,
  patron            text NOT NULL,
  grupo_muscular    text NOT NULL,
  nivel             text NOT NULL CHECK (nivel IN ('principiante','intermedio','avanzado')),
  equipo            text NOT NULL CHECK (equipo IN ('ninguno','banda','mancuernas','barra','maquina')),
  descripcion_breve text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercises_read ON exercises
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON TABLE exercises TO authenticated;
GRANT ALL ON TABLE exercises TO service_role;


-- ── 6. exercise_zones ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_zones (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  zona_corporal text NOT NULL,
  rol           text NOT NULL CHECK (rol IN ('primario','secundario')),
  UNIQUE (exercise_id, zona_corporal)
);

ALTER TABLE exercise_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_zones_read ON exercise_zones
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON TABLE exercise_zones TO authenticated;
GRANT ALL ON TABLE exercise_zones TO service_role;

CREATE INDEX IF NOT EXISTS ez_exercise_id_idx ON exercise_zones(exercise_id);
CREATE INDEX IF NOT EXISTS ez_zona_idx        ON exercise_zones(zona_corporal);


-- ── 7. exercise_restrictions ──────────────────────────────────
CREATE TABLE IF NOT EXISTS exercise_restrictions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id   uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  zona_corporal text NOT NULL,
  severidad     text NOT NULL CHECK (severidad IN ('forbidden','caution')),
  motivo        text,
  UNIQUE (exercise_id, zona_corporal)
);

ALTER TABLE exercise_restrictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY exercise_restrictions_read ON exercise_restrictions
  FOR SELECT TO authenticated USING (true);

GRANT ALL ON TABLE exercise_restrictions TO authenticated;
GRANT ALL ON TABLE exercise_restrictions TO service_role;

CREATE INDEX IF NOT EXISTS er_exercise_id_idx ON exercise_restrictions(exercise_id);
CREATE INDEX IF NOT EXISTS er_zona_idx        ON exercise_restrictions(zona_corporal);


-- ── 8. physio_routines ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS physio_routines (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id    uuid NOT NULL REFERENCES physio_clients(id) ON DELETE CASCADE,
  semana       integer NOT NULL,
  year         integer NOT NULL,
  routine_data jsonb NOT NULL,
  estado       text NOT NULL DEFAULT 'generada'
                   CHECK (estado IN ('generada','activa','completada','archivada')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE physio_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY physio_routines_business_access ON physio_routines
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

GRANT ALL ON TABLE physio_routines TO authenticated;
GRANT ALL ON TABLE physio_routines TO service_role;

CREATE INDEX IF NOT EXISTS physio_routines_client_id_idx   ON physio_routines(client_id);
CREATE INDEX IF NOT EXISTS physio_routines_business_id_idx ON physio_routines(business_id);
CREATE INDEX IF NOT EXISTS physio_routines_semana_idx      ON physio_routines(business_id, year, semana);


-- ── 9. physio_routine_exercises ───────────────────────────────
CREATE TABLE IF NOT EXISTS physio_routine_exercises (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id       uuid NOT NULL REFERENCES physio_routines(id) ON DELETE CASCADE,
  exercise_id      uuid NOT NULL REFERENCES exercises(id),
  dia              smallint NOT NULL CHECK (dia BETWEEN 1 AND 7),
  series           smallint NOT NULL,
  reps_o_segundos  integer NOT NULL,
  tempo            text,
  orden            smallint NOT NULL,
  notas_adaptacion text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE physio_routine_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY physio_routine_exercises_access ON physio_routine_exercises
  FOR ALL
  USING (
    routine_id IN (
      SELECT pr.id FROM physio_routines pr
      INNER JOIN profiles p ON p.business_id = pr.business_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    routine_id IN (
      SELECT pr.id FROM physio_routines pr
      INNER JOIN profiles p ON p.business_id = pr.business_id
      WHERE p.user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE physio_routine_exercises TO authenticated;
GRANT ALL ON TABLE physio_routine_exercises TO service_role;

CREATE INDEX IF NOT EXISTS pre_routine_id_idx ON physio_routine_exercises(routine_id);


-- ============================================================
-- SEED: zone_aliases
-- ============================================================
INSERT INTO zone_aliases (zona_usuario, zona_canonica) VALUES
  ('Columna cervical',   'columna_cervical'),
  ('Columna lumbar',     'columna_lumbar'),
  ('Hombro derecho',     'hombro'),
  ('Hombro izquierdo',   'hombro'),
  ('Rodilla derecha',    'rodilla'),
  ('Rodilla izquierda',  'rodilla'),
  ('Cadera derecha',     'cadera'),
  ('Cadera izquierda',   'cadera'),
  ('Tobillo derecho',    'tobillo'),
  ('Tobillo izquierdo',  'tobillo'),
  ('Muneca',             'muneca'),
  ('Codo',               'codo'),
  ('Cabeza / cuello',    'columna_cervical'),
  ('Codo derecho',       'codo'),
  ('Codo izquierdo',     'codo'),
  ('Muneca derecha',     'muneca'),
  ('Muneca izquierda',   'muneca'),
  ('Pecho / costillas',  'pecho'),
  ('Abdomen',            'abdomen'),
  ('Pie derecho',        'pie'),
  ('Pie izquierdo',      'pie')
ON CONFLICT (zona_usuario) DO NOTHING;


-- ============================================================
-- SEED: exercises (42)
-- ============================================================
INSERT INTO exercises (nombre, patron, grupo_muscular, nivel, equipo, descripcion_breve) VALUES
  ('Flexion de pecho',                 'empuje_horizontal',   'pecho',    'principiante', 'ninguno',    'Flexion clasica desde el suelo, cadena cinetica cerrada'),
  ('Flexion modificada en rodillas',   'empuje_horizontal',   'pecho',    'principiante', 'ninguno',    'Variante con rodillas apoyadas, menor carga en core y hombros'),
  ('Press con mancuernas en suelo',    'empuje_horizontal',   'pecho',    'intermedio',   'mancuernas', 'Press horizontal en decubito supino, rango limitado por el suelo'),
  ('Press de banca',                   'empuje_horizontal',   'pecho',    'avanzado',     'barra',      'Press horizontal estandar en banco plano'),
  ('Press de hombros con mancuernas',  'empuje_vertical',     'hombros',  'intermedio',   'mancuernas', 'Press sobre la cabeza sentado o de pie con mancuernas'),
  ('Pike pushup',                      'empuje_vertical',     'hombros',  'intermedio',   'ninguno',    'Flexion con caderas elevadas, mayor enfasis en deltoides'),
  ('Press militar con barra',          'empuje_vertical',     'hombros',  'avanzado',     'barra',      'Press sobre la cabeza de pie con barra, maxima demanda lumbar'),
  ('Remo con mancuerna un brazo',      'tiron_horizontal',    'espalda',  'intermedio',   'mancuernas', 'Remo unilateral con apoyo en banco, enfasis en dorsal y romboides'),
  ('Remo con banda',                   'tiron_horizontal',    'espalda',  'principiante', 'banda',      'Remo bilateral con banda elastica, bajo impacto articular'),
  ('Superman',                         'tiron_horizontal',    'espalda',  'principiante', 'ninguno',    'Extension simultanea de brazos y piernas en decubito prono'),
  ('Dominada asistida',                'tiron_vertical',      'espalda',  'avanzado',     'ninguno',    'Jalon vertical con peso corporal, asistido con banda o maquina'),
  ('Jalon con banda',                  'tiron_vertical',      'espalda',  'principiante', 'banda',      'Simulacion de jalon al pecho con banda anclada en alto'),
  ('Face pull con banda',              'tiron_vertical',      'hombros',  'principiante', 'banda',      'Tiron horizontal hacia la cara, fortalece manguito rotador'),
  ('Sentadilla con peso corporal',     'sentadilla',          'piernas',  'principiante', 'ninguno',    'Sentadilla libre sin carga adicional'),
  ('Sentadilla en silla',              'sentadilla',          'piernas',  'principiante', 'ninguno',    'Sit-to-stand desde una silla, ideal para rehabilitacion y mayores'),
  ('Goblet squat',                     'sentadilla',          'piernas',  'intermedio',   'mancuernas', 'Sentadilla con mancuerna sostenida al pecho, facilita la postura'),
  ('Sentadilla bulgara',               'sentadilla',          'piernas',  'avanzado',     'mancuernas', 'Sentadilla unilateral con pie trasero elevado'),
  ('Hip hinge con palo',               'bisagra',             'gluteos',  'principiante', 'ninguno',    'Bisagra de cadera guiada con palo para aprender el patron'),
  ('Peso muerto rumano con mancuernas','bisagra',             'gluteos',  'intermedio',   'mancuernas', 'Bisagra con mancuernas, enfasis en isquiotibiales y gluteos'),
  ('Buenos dias con banda',            'bisagra',             'gluteos',  'principiante', 'banda',      'Bisagra con resistencia de banda en hombros'),
  ('Peso muerto convencional',         'bisagra',             'gluteos',  'avanzado',     'barra',      'Peso muerto completo desde el suelo con barra'),
  ('Estocada estatica',                'zancada',             'piernas',  'principiante', 'ninguno',    'Zancada en posicion fija sin desplazamiento'),
  ('Step-up al escalon',               'zancada',             'piernas',  'principiante', 'ninguno',    'Subida unilateral a un escalon o cajon bajo'),
  ('Estocada caminando',               'zancada',             'piernas',  'intermedio',   'ninguno',    'Zancadas en desplazamiento continuo'),
  ('Estocada inversa con mancuernas',  'zancada',             'piernas',  'intermedio',   'mancuernas', 'Zancada hacia atras, menor estres patelofemoral que la frontal'),
  ('Plancha en codos',                 'core_anti_extension', 'core',     'principiante', 'ninguno',    'Plancha isometrica apoyado en antebrazos'),
  ('Plancha en manos',                 'core_anti_extension', 'core',     'intermedio',   'ninguno',    'Plancha isometrica en posicion de flexion extendida'),
  ('Dead bug',                         'core_anti_extension', 'core',     'principiante', 'ninguno',    'Extension alternada de brazo y pierna en decubito supino'),
  ('Extension en cuadrupedia',         'core_anti_extension', 'core',     'principiante', 'ninguno',    'Extension de un brazo o pierna desde posicion de cuatro puntos'),
  ('Pallof press con banda',           'core_anti_rotacion',  'core',     'principiante', 'banda',      'Press isometrico con banda, desafia la estabilidad rotacional'),
  ('Bird dog',                         'core_anti_rotacion',  'core',     'principiante', 'ninguno',    'Extension simultanea de brazo y pierna opuestos desde cuadrupedia'),
  ('Plancha lateral',                  'core_anti_rotacion',  'core',     'intermedio',   'ninguno',    'Plancha sobre un antebrazo, carga el core lateral y abductores'),
  ('Marcha en sitio',                  'cardio',              'cardio',   'principiante', 'ninguno',    'Marcha elevando rodillas, sin impacto'),
  ('Step lateral',                     'cardio',              'cardio',   'principiante', 'ninguno',    'Paso lateral continuo, activa abductores y cardio suave'),
  ('Jumping jack modificado',          'cardio',              'cardio',   'principiante', 'ninguno',    'Jumping jack sin salto, abriendo y cerrando brazos y piernas'),
  ('Marcha con rodillas altas',        'cardio',              'cardio',   'principiante', 'ninguno',    'Marcha exagerando elevacion de rodillas para mayor activacion'),
  ('Gato-camello',                     'movilidad',           'movilidad','principiante', 'ninguno',    'Flexion y extension alternada de columna en cuadrupedia'),
  ('Hip 90-90',                        'movilidad',           'movilidad','principiante', 'ninguno',    'Rotacion de cadera en posicion 90-90 sentado en el suelo'),
  ('Apertura toracica',                'movilidad',           'movilidad','principiante', 'ninguno',    'Rotacion de columna toracica en decubito lateral'),
  ('Estiramiento de cadera en cuadrupedia', 'movilidad',      'movilidad','principiante', 'ninguno',    'Pigeon modificado desde cuadrupedia, movilidad de cadera'),
  ('Circulos de hombros',              'movilidad',           'movilidad','principiante', 'ninguno',    'Circunduccion de hombros para calentar articulacion glenohumeral'),
  ('Movilidad de tobillo en pared',    'movilidad',           'movilidad','principiante', 'ninguno',    'Flexion dorsal de tobillo apoyado en pared')
ON CONFLICT (nombre) DO NOTHING;


-- ============================================================
-- SEED: exercise_zones
-- ============================================================
WITH ex AS (SELECT id, nombre FROM exercises)
INSERT INTO exercise_zones (exercise_id, zona_corporal, rol)
SELECT ex.id, v.zona_corporal, v.rol
FROM (VALUES
  ('Flexion de pecho','pecho','primario'),('Flexion de pecho','hombro','primario'),('Flexion de pecho','codo','primario'),('Flexion de pecho','muneca','secundario'),
  ('Flexion modificada en rodillas','pecho','primario'),('Flexion modificada en rodillas','hombro','primario'),('Flexion modificada en rodillas','codo','primario'),('Flexion modificada en rodillas','rodilla','secundario'),
  ('Press con mancuernas en suelo','pecho','primario'),('Press con mancuernas en suelo','hombro','primario'),('Press con mancuernas en suelo','codo','primario'),('Press con mancuernas en suelo','muneca','secundario'),
  ('Press de banca','pecho','primario'),('Press de banca','hombro','primario'),('Press de banca','codo','primario'),('Press de banca','columna_lumbar','secundario'),
  ('Press de hombros con mancuernas','hombro','primario'),('Press de hombros con mancuernas','codo','primario'),('Press de hombros con mancuernas','muneca','secundario'),('Press de hombros con mancuernas','columna_lumbar','secundario'),('Press de hombros con mancuernas','columna_cervical','secundario'),
  ('Pike pushup','hombro','primario'),('Pike pushup','codo','primario'),('Pike pushup','muneca','primario'),
  ('Press militar con barra','hombro','primario'),('Press militar con barra','codo','primario'),('Press militar con barra','columna_lumbar','primario'),('Press militar con barra','columna_cervical','secundario'),
  ('Remo con mancuerna un brazo','hombro','primario'),('Remo con mancuerna un brazo','codo','secundario'),('Remo con mancuerna un brazo','columna_lumbar','secundario'),
  ('Remo con banda','hombro','primario'),('Remo con banda','codo','secundario'),
  ('Superman','columna_lumbar','primario'),('Superman','cadera','secundario'),('Superman','columna_cervical','secundario'),
  ('Dominada asistida','hombro','primario'),('Dominada asistida','codo','primario'),('Dominada asistida','muneca','secundario'),('Dominada asistida','columna_cervical','secundario'),
  ('Jalon con banda','hombro','primario'),('Jalon con banda','codo','secundario'),
  ('Face pull con banda','hombro','primario'),('Face pull con banda','codo','secundario'),
  ('Sentadilla con peso corporal','rodilla','primario'),('Sentadilla con peso corporal','cadera','primario'),('Sentadilla con peso corporal','columna_lumbar','secundario'),('Sentadilla con peso corporal','tobillo','secundario'),
  ('Sentadilla en silla','rodilla','primario'),('Sentadilla en silla','cadera','primario'),('Sentadilla en silla','columna_lumbar','secundario'),
  ('Goblet squat','rodilla','primario'),('Goblet squat','cadera','primario'),('Goblet squat','columna_lumbar','secundario'),('Goblet squat','hombro','secundario'),('Goblet squat','muneca','secundario'),
  ('Sentadilla bulgara','rodilla','primario'),('Sentadilla bulgara','cadera','primario'),('Sentadilla bulgara','tobillo','secundario'),('Sentadilla bulgara','columna_lumbar','secundario'),
  ('Hip hinge con palo','columna_lumbar','primario'),('Hip hinge con palo','cadera','primario'),('Hip hinge con palo','rodilla','secundario'),
  ('Peso muerto rumano con mancuernas','columna_lumbar','primario'),('Peso muerto rumano con mancuernas','cadera','primario'),('Peso muerto rumano con mancuernas','rodilla','secundario'),('Peso muerto rumano con mancuernas','muneca','secundario'),
  ('Buenos dias con banda','columna_lumbar','primario'),('Buenos dias con banda','cadera','primario'),('Buenos dias con banda','rodilla','secundario'),
  ('Peso muerto convencional','columna_lumbar','primario'),('Peso muerto convencional','cadera','primario'),('Peso muerto convencional','rodilla','primario'),('Peso muerto convencional','muneca','secundario'),
  ('Estocada estatica','rodilla','primario'),('Estocada estatica','cadera','primario'),('Estocada estatica','tobillo','secundario'),('Estocada estatica','columna_lumbar','secundario'),
  ('Step-up al escalon','rodilla','primario'),('Step-up al escalon','cadera','primario'),('Step-up al escalon','tobillo','secundario'),
  ('Estocada caminando','rodilla','primario'),('Estocada caminando','cadera','primario'),('Estocada caminando','tobillo','secundario'),
  ('Estocada inversa con mancuernas','rodilla','primario'),('Estocada inversa con mancuernas','cadera','primario'),('Estocada inversa con mancuernas','tobillo','secundario'),('Estocada inversa con mancuernas','muneca','secundario'),
  ('Plancha en codos','core','primario'),('Plancha en codos','hombro','secundario'),('Plancha en codos','codo','secundario'),('Plancha en codos','columna_lumbar','secundario'),
  ('Plancha en manos','core','primario'),('Plancha en manos','hombro','secundario'),('Plancha en manos','muneca','primario'),('Plancha en manos','columna_lumbar','secundario'),
  ('Dead bug','core','primario'),('Dead bug','columna_lumbar','secundario'),
  ('Extension en cuadrupedia','core','primario'),('Extension en cuadrupedia','muneca','secundario'),('Extension en cuadrupedia','columna_lumbar','secundario'),
  ('Pallof press con banda','core','primario'),('Pallof press con banda','hombro','secundario'),('Pallof press con banda','columna_lumbar','secundario'),
  ('Bird dog','core','primario'),('Bird dog','muneca','secundario'),('Bird dog','columna_lumbar','secundario'),('Bird dog','cadera','secundario'),
  ('Plancha lateral','core','primario'),('Plancha lateral','hombro','primario'),('Plancha lateral','codo','secundario'),('Plancha lateral','columna_lumbar','secundario'),
  ('Marcha en sitio','cadera','secundario'),('Marcha en sitio','rodilla','secundario'),
  ('Step lateral','cadera','secundario'),('Step lateral','rodilla','secundario'),('Step lateral','tobillo','secundario'),
  ('Jumping jack modificado','cadera','secundario'),('Jumping jack modificado','tobillo','secundario'),
  ('Marcha con rodillas altas','cadera','primario'),('Marcha con rodillas altas','rodilla','primario'),('Marcha con rodillas altas','columna_lumbar','secundario'),
  ('Gato-camello','columna_lumbar','primario'),('Gato-camello','columna_cervical','secundario'),
  ('Hip 90-90','cadera','primario'),('Hip 90-90','rodilla','secundario'),
  ('Apertura toracica','columna_cervical','secundario'),('Apertura toracica','hombro','secundario'),
  ('Estiramiento de cadera en cuadrupedia','cadera','primario'),('Estiramiento de cadera en cuadrupedia','rodilla','secundario'),('Estiramiento de cadera en cuadrupedia','muneca','secundario'),
  ('Circulos de hombros','hombro','primario'),('Circulos de hombros','columna_cervical','secundario'),
  ('Movilidad de tobillo en pared','tobillo','primario'),('Movilidad de tobillo en pared','rodilla','secundario')
) AS v(nombre, zona_corporal, rol)
JOIN ex ON ex.nombre = v.nombre
ON CONFLICT (exercise_id, zona_corporal) DO NOTHING;


-- ============================================================
-- SEED: exercise_restrictions
-- ============================================================
WITH ex AS (SELECT id, nombre FROM exercises)
INSERT INTO exercise_restrictions (exercise_id, zona_corporal, severidad, motivo)
SELECT ex.id, v.zona_corporal, v.severidad, v.motivo
FROM (VALUES
  ('Flexion de pecho','hombro','forbidden','Carga directa glenohumeral en cadena cerrada'),
  ('Flexion de pecho','muneca','forbidden','Compresion en extension de muneca bajo carga'),
  ('Flexion de pecho','codo','caution','Tension en epicondilos, reducir rango si hay dolor'),
  ('Flexion de pecho','columna_cervical','caution','Tension cervical durante el esfuerzo'),
  ('Flexion modificada en rodillas','hombro','forbidden','Carga glenohumeral aunque menor que flexion completa'),
  ('Flexion modificada en rodillas','muneca','forbidden','Compresion en muneca aunque reduce algo la carga'),
  ('Flexion modificada en rodillas','codo','caution','Tension en epicondilos'),
  ('Flexion modificada en rodillas','rodilla','caution','Presion rotuliana directa sobre el suelo'),
  ('Press con mancuernas en suelo','hombro','forbidden','Carga glenohumeral en press horizontal'),
  ('Press con mancuernas en suelo','codo','caution','Tension en articulacion del codo'),
  ('Press con mancuernas en suelo','muneca','caution','Menor que flexion pero hay compresion'),
  ('Press de banca','hombro','forbidden','Maxima carga glenohumeral en rango amplio'),
  ('Press de banca','codo','caution','Tension en epicondilos bajo carga'),
  ('Press de banca','muneca','caution','Compresion en muneca'),
  ('Press de banca','columna_lumbar','caution','Arqueo lumbar compensatorio habitual'),
  ('Press de hombros con mancuernas','hombro','forbidden','Carga axilar maxima en overhead press'),
  ('Press de hombros con mancuernas','columna_lumbar','caution','Carga axial sobre columna en overhead'),
  ('Press de hombros con mancuernas','columna_cervical','caution','Compresion cervical bajo carga overhead'),
  ('Press de hombros con mancuernas','codo','caution','Tension en articulacion del codo'),
  ('Press de hombros con mancuernas','muneca','caution','Compresion en extension de muneca'),
  ('Pike pushup','hombro','forbidden','Angulo de carga shoulder-dominant'),
  ('Pike pushup','muneca','forbidden','Compresion maxima en muneca en flexion'),
  ('Pike pushup','codo','caution','Tension en articulacion del codo'),
  ('Pike pushup','columna_cervical','caution','Posicion de cabeza invertida genera tension'),
  ('Press militar con barra','hombro','forbidden','Maxima carga axial glenohumeral'),
  ('Press militar con barra','columna_lumbar','forbidden','Carga axial bilateral pesada sobre columna'),
  ('Press militar con barra','columna_cervical','caution','Compresion cervical alta bajo carga'),
  ('Press militar con barra','muneca','caution','Agarre en extension con carga pesada'),
  ('Remo con mancuerna un brazo','columna_lumbar','caution','Posicion de bisagra sostenida, tension lumbar'),
  ('Remo con mancuerna un brazo','hombro','caution','Carga glenohumeral en rango posterior'),
  ('Remo con banda','hombro','caution','Carga glenohumeral moderada'),
  ('Superman','columna_lumbar','forbidden','Extension activa lumbar bajo carga, contraindicado en patologia discal'),
  ('Superman','columna_cervical','caution','Hiperextension cervical en la posicion'),
  ('Dominada asistida','hombro','forbidden','Traccion maxima glenohumeral con peso corporal'),
  ('Dominada asistida','codo','caution','Tension en flexores del codo bajo carga'),
  ('Dominada asistida','muneca','caution','Compresion en agarre'),
  ('Dominada asistida','columna_cervical','caution','Tension cervical en traccion'),
  ('Jalon con banda','hombro','forbidden','Carga glenohumeral en jalon'),
  ('Jalon con banda','codo','caution','Tension en flexores del codo'),
  ('Face pull con banda','hombro','caution','Carga en rotacion externa glenohumeral'),
  ('Face pull con banda','codo','caution','Tension leve en flexion de codo'),
  ('Sentadilla con peso corporal','rodilla','forbidden','Maxima carga femoropatelar en flexion profunda'),
  ('Sentadilla con peso corporal','cadera','caution','Compresion acetabular en flexion de cadera'),
  ('Sentadilla con peso corporal','columna_lumbar','caution','Tension lumbar con inclinacion anterior del tronco'),
  ('Sentadilla con peso corporal','tobillo','caution','Requiere flexion dorsal de tobillo'),
  ('Sentadilla en silla','rodilla','caution','Mucho menor carga que squat libre, version rehabilitadora'),
  ('Sentadilla en silla','cadera','caution','Compresion acetabular moderada'),
  ('Sentadilla en silla','columna_lumbar','caution','Tension lumbar leve'),
  ('Goblet squat','rodilla','forbidden','Carga femoropatelar alta aunque postura es mejor'),
  ('Goblet squat','cadera','caution','Compresion acetabular'),
  ('Goblet squat','columna_lumbar','caution','Tension lumbar con peso frontal'),
  ('Goblet squat','muneca','caution','Agarre en flexion de muneca'),
  ('Sentadilla bulgara','rodilla','forbidden','Alta carga patelofemoral unilateral'),
  ('Sentadilla bulgara','cadera','forbidden','Maxima amplitud articular cadera en estiramiento'),
  ('Sentadilla bulgara','columna_lumbar','caution','Tension lumbar bajo carga unilateral'),
  ('Sentadilla bulgara','tobillo','caution','Tension en extension de tobillo trasero'),
  ('Hip hinge con palo','columna_lumbar','caution','Patron de bisagra incluso sin carga'),
  ('Peso muerto rumano con mancuernas','columna_lumbar','forbidden','Carga axial en bisagra con columna en flexion'),
  ('Peso muerto rumano con mancuernas','rodilla','caution','Tension en isquiotibiales con rodilla semi-extendida'),
  ('Peso muerto rumano con mancuernas','muneca','caution','Agarre bajo carga sostenida'),
  ('Buenos dias con banda','columna_lumbar','forbidden','Bisagra con carga en hombros, alto momento lumbar'),
  ('Buenos dias con banda','cadera','caution','Tension en flexion de cadera profunda'),
  ('Peso muerto convencional','columna_lumbar','forbidden','Maxima carga axial sobre columna'),
  ('Peso muerto convencional','rodilla','caution','Tension en arranque desde el suelo'),
  ('Peso muerto convencional','cadera','caution','Compresion acetabular en inicio del movimiento'),
  ('Peso muerto convencional','muneca','caution','Agarre bajo carga maxima'),
  ('Estocada estatica','rodilla','forbidden','Carga femoropatelar alta en flexion'),
  ('Estocada estatica','cadera','caution','Elongacion del flexor de cadera posterior'),
  ('Estocada estatica','tobillo','caution','Requiere estabilidad de tobillo'),
  ('Step-up al escalon','rodilla','caution','Carga femoropatelar moderada, version mas segura'),
  ('Step-up al escalon','tobillo','caution','Requiere estabilidad de tobillo'),
  ('Step-up al escalon','cadera','caution','Carga de cadera en elevacion unilateral'),
  ('Estocada caminando','rodilla','forbidden','Carga femoropatelar repetida en movimiento'),
  ('Estocada caminando','tobillo','caution','Mayor demanda de estabilidad que estocada estatica'),
  ('Estocada caminando','cadera','caution','Elongacion repetida del flexor de cadera'),
  ('Estocada inversa con mancuernas','rodilla','caution','Menor carga patelofemoral que estocada frontal'),
  ('Estocada inversa con mancuernas','cadera','caution','Tension en extension de cadera trasera'),
  ('Estocada inversa con mancuernas','tobillo','caution','Estabilidad de tobillo en paso atras'),
  ('Estocada inversa con mancuernas','muneca','caution','Agarre de mancuernas bajo carga'),
  ('Plancha en codos','columna_lumbar','caution','Tension lumbar isometrica sostenida'),
  ('Plancha en codos','hombro','caution','Carga glenohumeral en posicion de soporte'),
  ('Plancha en codos','codo','caution','Presion en codo sobre el suelo'),
  ('Plancha en manos','muneca','forbidden','Maxima compresion en extension de muneca bajo carga'),
  ('Plancha en manos','columna_lumbar','caution','Tension lumbar isometrica'),
  ('Plancha en manos','hombro','caution','Carga glenohumeral en soporte'),
  ('Dead bug','columna_lumbar','caution','Extension de extremidades genera tension lumbar leve'),
  ('Extension en cuadrupedia','muneca','caution','Carga en extension de muneca sobre el suelo'),
  ('Extension en cuadrupedia','columna_lumbar','caution','Tension lumbar en extension de pierna'),
  ('Pallof press con banda','hombro','caution','Carga glenohumeral en el press'),
  ('Pallof press con banda','columna_lumbar','caution','Tension anti-rotacional sobre columna'),
  ('Bird dog','muneca','caution','Carga en muneca en cuadrupedia'),
  ('Bird dog','columna_lumbar','caution','Tension lumbar leve en extension de pierna'),
  ('Plancha lateral','hombro','forbidden','Carga directa glenohumeral en soporte lateral'),
  ('Plancha lateral','muneca','caution','Si se hace en mano en vez de antebrazo'),
  ('Plancha lateral','columna_lumbar','caution','Tension lumbar en posicion lateral'),
  ('Step lateral','rodilla','caution','Carga abductora leve en rodilla'),
  ('Step lateral','tobillo','caution','Requiere estabilidad lateral de tobillo'),
  ('Jumping jack modificado','rodilla','caution','Sin impacto pero hay abduccion repetida'),
  ('Jumping jack modificado','tobillo','caution','Movimiento lateral repetido de tobillo'),
  ('Marcha con rodillas altas','cadera','caution','Flexion de cadera repetida con carga'),
  ('Marcha con rodillas altas','rodilla','caution','Flexion de rodilla repetida'),
  ('Marcha con rodillas altas','columna_lumbar','caution','Tension lumbar con movimiento de rodillas altas'),
  ('Gato-camello','columna_cervical','caution','Evitar hiperextension cervical en la fase de extension'),
  ('Hip 90-90','cadera','caution','Rotacion pasiva de cadera, leve en patologia aguda'),
  ('Hip 90-90','rodilla','caution','Tension leve en rodilla en posicion 90-90'),
  ('Apertura toracica','hombro','caution','Rotacion con brazo, leve carga glenohumeral'),
  ('Apertura toracica','columna_cervical','caution','Rotacion que puede involucrar cervical'),
  ('Estiramiento de cadera en cuadrupedia','muneca','caution','Carga en extension de muneca en cuadrupedia'),
  ('Estiramiento de cadera en cuadrupedia','rodilla','caution','Presion de rodilla sobre el suelo'),
  ('Estiramiento de cadera en cuadrupedia','cadera','caution','Estiramiento pasivo de cadera, leve en agudo'),
  ('Circulos de hombros','hombro','forbidden','Movimiento circular completo contraindicado en fase inflamatoria aguda'),
  ('Circulos de hombros','columna_cervical','caution','Movimiento de hombros puede tensar cervical'),
  ('Movilidad de tobillo en pared','tobillo','caution','Trabajo de rango de tobillo, leve en agudo'),
  ('Movilidad de tobillo en pared','rodilla','caution','Tension leve en rodilla en flexion dorsal')
) AS v(nombre, zona_corporal, severidad, motivo)
JOIN ex ON ex.nombre = v.nombre
ON CONFLICT (exercise_id, zona_corporal) DO NOTHING;
