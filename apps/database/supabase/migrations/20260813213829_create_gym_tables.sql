-- ============================================================
-- Gym — schema completo
-- Tablas: gym_clients, gym_nutrition_profile, gym_client_users,
--         gym_measurements, gym_goals, gym_routines,
--         gym_routine_exercises
-- Tablas compartidas (sin cambios): exercises, measurement_types
-- ============================================================

-- Helper para RLS (reutilizable en todas las políticas)
-- Retorna el business_id del usuario autenticado vía profiles.
-- Se usa como subquery inline para mantener consistencia con physio.

-- ── 1. gym_clients ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gym_clients (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  roda_customer_id        uuid        REFERENCES customers(id) ON DELETE SET NULL,

  -- Datos personales
  nombre                  text        NOT NULL,
  email                   text,
  telefono                text,
  fecha_nacimiento        date,
  sexo                    text        CHECK (sexo IN ('masculino', 'femenino', 'otro')),

  -- Perfil de entrenamiento
  nivel_entrenamiento     text        NOT NULL DEFAULT 'novato'
                                      CHECK (nivel_entrenamiento IN ('novato', 'intermedio', 'avanzado')),
  tiempo_entrenando       text,
  objetivo_principal      text        CHECK (objetivo_principal IN (
                                        'hipertrofia', 'perdida_grasa', 'fuerza',
                                        'resistencia', 'rendimiento'
                                      )),
  dias_disponibles        integer[]   NOT NULL DEFAULT '{}',

  -- Estilo de vida
  horario_laboral         text,
  hora_despertar          time,
  hora_dormir             time,
  hora_entrenar           time,
  deporte_alterno         text,

  -- Salud
  usa_esteroides          boolean     NOT NULL DEFAULT false,
  problema_cardiovascular text,
  lesion_actual           text,
  zona_a_mejorar          text,

  notas                   text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_clients_business_access ON gym_clients
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

GRANT ALL ON TABLE gym_clients TO authenticated;
GRANT ALL ON TABLE gym_clients TO service_role;

CREATE INDEX IF NOT EXISTS gym_clients_business_id_idx       ON gym_clients(business_id);
CREATE INDEX IF NOT EXISTS gym_clients_roda_customer_id_idx  ON gym_clients(roda_customer_id);


-- ── 2. gym_nutrition_profile ──────────────────────────────────
-- Una fila por cliente (UNIQUE en client_id).
-- frecuencia_consumo sigue el formato:
--   { "leche": { "frecuencia": "diario"|"semanal"|"mensual"|"nunca", "veces": 3 }, ... }

CREATE TABLE IF NOT EXISTS gym_nutrition_profile (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id                 uuid        NOT NULL UNIQUE REFERENCES gym_clients(id) ON DELETE CASCADE,
  business_id               uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Preferencias alimentarias
  frutas_preferidas         text,
  vegetales_preferidos      text,
  comida_saludable_favorita text,
  comida_chatarra_favorita  text,
  frecuencia_chatarra       text,
  comida_dulce_favorita     text,
  frecuencia_dulce          text,

  -- Azúcar
  consume_azucar            boolean,
  veces_azucar_dia          integer,

  -- Restricciones
  alimento_prohibido        text,
  razon_prohibido           text,

  -- Suplementos
  consume_suplementos       boolean,
  cuales_suplementos        text,

  -- Comidas habituales
  -- Array de { comida: text, hora: text, descripcion: text }
  comidas_entre_semana      jsonb       NOT NULL DEFAULT '[]',
  comidas_fin_semana        jsonb       NOT NULL DEFAULT '[]',

  -- Checklist de frecuencia de consumo por grupo de alimento.
  -- Cada clave: { "frecuencia": "diario"|"semanal"|"mensual"|"nunca", "veces": number|null }
  -- Claves esperadas: leche, kumis, queso, carne, pollo, pescado, cerdo,
  --   visceras, embutidos, huevo, leguminosas, verduras, frutas, pan,
  --   arroz, pasta, papa, platano, productos_paquete, comidas_rapidas,
  --   dulces, gaseosas, margarina, aceite, agua
  frecuencia_consumo        jsonb       NOT NULL DEFAULT '{}',

  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym_nutrition_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_nutrition_profile_business_access ON gym_nutrition_profile
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

GRANT ALL ON TABLE gym_nutrition_profile TO authenticated;
GRANT ALL ON TABLE gym_nutrition_profile TO service_role;

CREATE INDEX IF NOT EXISTS gym_nutrition_profile_client_id_idx   ON gym_nutrition_profile(client_id);
CREATE INDEX IF NOT EXISTS gym_nutrition_profile_business_id_idx ON gym_nutrition_profile(business_id);


-- ── 3. gym_client_users ───────────────────────────────────────
-- Vincula un gym_client a una cuenta auth.users (portal del cliente).

CREATE TABLE IF NOT EXISTS gym_client_users (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  gym_client_id   uuid        NOT NULL UNIQUE REFERENCES gym_clients(id) ON DELETE CASCADE,
  auth_user_id    uuid        NOT NULL UNIQUE REFERENCES auth.users(id)  ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym_client_users ENABLE ROW LEVEL SECURITY;

-- El cliente lee su propia fila
CREATE POLICY gcu_self_read ON gym_client_users
  FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

-- El dueño del negocio lee todos los vínculos de sus clientes
CREATE POLICY gcu_business_read ON gym_client_users
  FOR SELECT TO authenticated
  USING (
    gym_client_id IN (
      SELECT id FROM gym_clients
      WHERE business_id IN (
        SELECT business_id FROM profiles WHERE user_id = auth.uid()
      )
    )
  );

GRANT SELECT ON gym_client_users TO authenticated;
GRANT ALL    ON gym_client_users TO service_role;

CREATE INDEX IF NOT EXISTS gym_client_users_client_idx ON gym_client_users(gym_client_id);
CREATE INDEX IF NOT EXISTS gym_client_users_user_idx   ON gym_client_users(auth_user_id);


-- ── 4. gym_measurements ───────────────────────────────────────
-- Paralela a patient_measurements; FK a gym_clients.
-- Reutiliza el catálogo measurement_types (applies_to IN ('gym','ambos')).

CREATE TABLE IF NOT EXISTS gym_measurements (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id        uuid        NOT NULL REFERENCES gym_clients(id) ON DELETE CASCADE,
  measurement_type text        NOT NULL REFERENCES measurement_types(code),
  value            numeric     NOT NULL,
  unit             text,
  measured_at      date        NOT NULL DEFAULT CURRENT_DATE,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_measurements_business_access ON gym_measurements
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

-- El cliente lee sus propias mediciones
CREATE POLICY gym_measurements_client_read ON gym_measurements
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT gym_client_id FROM gym_client_users
      WHERE auth_user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE gym_measurements TO authenticated;
GRANT ALL ON TABLE gym_measurements TO service_role;

CREATE INDEX IF NOT EXISTS gym_measurements_client_id_idx   ON gym_measurements(client_id);
CREATE INDEX IF NOT EXISTS gym_measurements_business_id_idx ON gym_measurements(business_id);
CREATE INDEX IF NOT EXISTS gym_measurements_type_idx        ON gym_measurements(measurement_type);
CREATE INDEX IF NOT EXISTS gym_measurements_measured_at_idx ON gym_measurements(measured_at);


-- ── 5. gym_goals ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gym_goals (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id      uuid        NOT NULL REFERENCES gym_clients(id) ON DELETE CASCADE,
  descripcion    text        NOT NULL,
  fecha_objetivo date,
  estado         text        NOT NULL DEFAULT 'activo'
                             CHECK (estado IN ('activo', 'completado', 'pausado')),
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_goals_business_access ON gym_goals
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY gym_goals_client_read ON gym_goals
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT gym_client_id FROM gym_client_users
      WHERE auth_user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE gym_goals TO authenticated;
GRANT ALL ON TABLE gym_goals TO service_role;

CREATE INDEX IF NOT EXISTS gym_goals_client_id_idx   ON gym_goals(client_id);
CREATE INDEX IF NOT EXISTS gym_goals_business_id_idx ON gym_goals(business_id);


-- ── 6. gym_routines ───────────────────────────────────────────
-- Rutinas semanales de entrenamiento (equivalente a physio_routines).
-- routine_data almacena la estructura completa generada por IA o manualmente.

CREATE TABLE IF NOT EXISTS gym_routines (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  client_id    uuid        NOT NULL REFERENCES gym_clients(id) ON DELETE CASCADE,
  semana       integer     NOT NULL,
  year         integer     NOT NULL,
  routine_data jsonb       NOT NULL,
  estado       text        NOT NULL DEFAULT 'generada'
                           CHECK (estado IN ('generada', 'activa', 'completada', 'archivada')),
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym_routines ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_routines_business_access ON gym_routines
  FOR ALL
  USING (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ))
  WITH CHECK (business_id IN (
    SELECT business_id FROM profiles WHERE user_id = auth.uid()
  ));

CREATE POLICY gym_routines_client_read ON gym_routines
  FOR SELECT TO authenticated
  USING (
    client_id IN (
      SELECT gym_client_id FROM gym_client_users
      WHERE auth_user_id = auth.uid()
    )
  );

GRANT ALL ON TABLE gym_routines TO authenticated;
GRANT ALL ON TABLE gym_routines TO service_role;

CREATE INDEX IF NOT EXISTS gym_routines_client_id_idx   ON gym_routines(client_id);
CREATE INDEX IF NOT EXISTS gym_routines_business_id_idx ON gym_routines(business_id);
CREATE INDEX IF NOT EXISTS gym_routines_semana_idx      ON gym_routines(business_id, year, semana);


-- ── 7. gym_routine_exercises ──────────────────────────────────
-- Ejericios concretos de una rutina; FK al catálogo compartido exercises.

CREATE TABLE IF NOT EXISTS gym_routine_exercises (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id       uuid        NOT NULL REFERENCES gym_routines(id) ON DELETE CASCADE,
  exercise_id      uuid        NOT NULL REFERENCES exercises(id),
  dia              smallint    NOT NULL CHECK (dia BETWEEN 1 AND 7),
  series           smallint    NOT NULL,
  reps_o_segundos  integer     NOT NULL,
  tempo            text,
  orden            smallint    NOT NULL,
  notas_adaptacion text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE gym_routine_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY gym_routine_exercises_access ON gym_routine_exercises
  FOR ALL
  USING (
    routine_id IN (
      SELECT gr.id FROM gym_routines gr
      INNER JOIN profiles p ON p.business_id = gr.business_id
      WHERE p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    routine_id IN (
      SELECT gr.id FROM gym_routines gr
      INNER JOIN profiles p ON p.business_id = gr.business_id
      WHERE p.user_id = auth.uid()
    )
  );

-- El cliente lee sus propios ejercicios de rutina
CREATE POLICY gym_routine_exercises_client_read ON gym_routine_exercises
  FOR SELECT TO authenticated
  USING (
    routine_id IN (
      SELECT gr.id FROM gym_routines gr
      WHERE gr.client_id IN (
        SELECT gym_client_id FROM gym_client_users
        WHERE auth_user_id = auth.uid()
      )
    )
  );

GRANT ALL ON TABLE gym_routine_exercises TO authenticated;
GRANT ALL ON TABLE gym_routine_exercises TO service_role;

CREATE INDEX IF NOT EXISTS gre_routine_id_idx ON gym_routine_exercises(routine_id);


-- ── 8. updated_at triggers ────────────────────────────────────
-- Reutiliza la función set_updated_at si ya existe (definida en physio migrations).

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER gym_clients_updated_at
  BEFORE UPDATE ON gym_clients
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER gym_nutrition_profile_updated_at
  BEFORE UPDATE ON gym_nutrition_profile
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
