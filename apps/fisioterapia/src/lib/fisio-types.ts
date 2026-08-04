export interface PhysioClient {
  id: string;
  business_id: string;
  nombre: string;
  email: string | null;
  telefono: string | null;
  fecha_nacimiento: string | null;
  nivel_fisico: 'principiante' | 'intermedio' | 'avanzado';
  objetivo: string;
  dias_disponibles: number[];
  notas: string | null;
  created_at: string;
  updated_at: string;
}

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
  caution_notes: string[];
}

export interface DraftEjercicio {
  exercise_id: string;
  nombre: string;
  series: number;
  repeticiones: string;
  descanso_seg: number;
  nota?: string;
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
