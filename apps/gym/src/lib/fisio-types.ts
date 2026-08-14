export interface GymClient {
  id: string;
  business_id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  sexo: 'masculino' | 'femenino' | 'otro' | null;
  nivel_entrenamiento: 'novato' | 'intermedio' | 'avanzado';
  tiempo_entrenando: string | null;
  objetivo_principal: string | null;
  dias_disponibles: number[];
  horario_laboral: string | null;
  hora_despertar: string | null;
  hora_dormir: string | null;
  hora_entrenar: string | null;
  deporte_alterno: string | null;
  usa_esteroides: boolean;
  problema_cardiovascular: string | null;
  lesion_actual: string | null;
  zona_a_mejorar: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

/** @deprecated Use GymClient */
export type PhysioClient = GymClient;

export interface Pathology {
  id: string;
  client_id: string;
  nombre: string;
  zona_corporal: string;
  fecha_diagnostico: string | null;
  notas: string | null;
}

export interface PainEntry {
  id?: string;
  zona_corporal: string;
  mecanica: string;
  nivel: number;
}

export interface SafeExercise {
  id: string;
  nombre: string;
  patron: string;
  grupo_muscular: string;
  nivel: string;
  equipo: string;
  descripcion_breve: string;
  gif_url?: string | null;
  caution_notes: string[];
}

export interface ExerciseWithFlags extends SafeExercise {
  forbidden: boolean;
}

export interface DraftEjercicio {
  exercise_id: string;
  nombre: string;
  series: number;
  repeticiones: string;
  descanso_seg: number;
  nota?: string;
  gif_url?: string | null;
}

export interface DraftDia {
  dia_index: number;
  nombre: string;
  ejercicios: DraftEjercicio[];
}

export interface PhysioRoutine {
  id: string;
  client_id: string;
  semana: number;
  year: number;
  routine_data: {
    dias: DraftDia[];
    notas_generales: string | null;
  };
  estado: 'generada' | 'activa' | 'completada' | 'archivada';
  generated_at: string;
}
