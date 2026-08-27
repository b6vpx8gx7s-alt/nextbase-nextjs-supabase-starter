import type { SupabaseClient } from '@supabase/supabase-js';
import type { SafeExercise, ExerciseWithFlags, DraftDia } from '@/lib/fisio-types';

export type { SafeExercise, DraftDia };

export function parseReps(rep: string): number {
  const match = rep.match(/\d+/);
  return match ? parseInt(match[0], 10) : 10;
}

/**
 * Pre-filtro determinista.
 * Devuelve ejercicios seguros para este cliente:
 *   - Excluye ejercicios con restricción 'forbidden' en zonas del cliente
 *     (patologías + dolor nivel >= 4)
 *   - Marca con caution_notes los que tienen restricción 'caution'
 */
export async function getSafeExercises(
  _clientId: string,
  supabase: SupabaseClient,
  businessId: string
): Promise<SafeExercise[]> {
  // Gym clients have no pathologies/pain_map data (those tables FK to physio_clients).
  // All exercises are safe by default; caution_notes are always empty for gym.
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('id, nombre, patron, grupo_muscular, nivel, equipo, descripcion_breve, gif_url')
    .or(`visibility.eq.public,business_id.eq.${businessId}`)
    .in('context', ['gym', 'ambos']);

  if (error || !exercises) throw new Error('Error fetching exercises: ' + error?.message);

  return exercises.map((ex) => ({
    id: (ex as { id: string }).id,
    nombre: (ex as { nombre: string }).nombre,
    patron: (ex as { patron: string }).patron ?? '',
    grupo_muscular: (ex as { grupo_muscular: string }).grupo_muscular ?? '',
    nivel: (ex as { nivel: string }).nivel ?? '',
    equipo: (ex as { equipo: string }).equipo ?? '',
    descripcion_breve: (ex as { descripcion_breve: string }).descripcion_breve ?? '',
    gif_url: (ex as { gif_url?: string | null }).gif_url ?? null,
    caution_notes: [],
  }));
}

/**
 * Returns ALL exercises (including forbidden ones) with per-patient
 * restriction flags so the manual builder can show 🚫/⚠️ badges.
 */
export async function getAllExercisesWithFlags(
  _clientId: string,
  supabase: SupabaseClient,
  businessId: string
): Promise<ExerciseWithFlags[]> {
  // Gym clients have no pathologies/pain_map data (those tables FK to physio_clients).
  // Skip the zone resolution, exercise_restrictions join, and descripcion_breve
  // (unused by the manual builder) to minimize payload and query cost.
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('id, nombre, patron, grupo_muscular, nivel, equipo, gif_url')
    .or(`visibility.eq.public,business_id.eq.${businessId}`)
    .in('context', ['gym', 'ambos'])
    .order('grupo_muscular')
    .order('nombre');

  if (error || !exercises) throw new Error('Error fetching exercises: ' + error?.message);

  return exercises.map((ex) => ({
    id: (ex as { id: string }).id,
    nombre: (ex as { nombre: string }).nombre,
    patron: (ex as { patron: string }).patron ?? '',
    grupo_muscular: (ex as { grupo_muscular: string }).grupo_muscular ?? '',
    nivel: (ex as { nivel: string }).nivel ?? '',
    equipo: (ex as { equipo: string }).equipo ?? '',
    descripcion_breve: '',
    gif_url: (ex as { gif_url?: string | null }).gif_url ?? null,
    forbidden: false,
    caution_notes: [],
  }));
}

/**
 * Post-validación: elimina del draft cualquier exercise_id que no esté
 * en la lista segura (defensa contra alucinaciones de Claude).
 */
export function postValidate(dias: DraftDia[], safe: SafeExercise[]): DraftDia[] {
  const safeIds = new Set(safe.map((e) => e.id));
  return dias.map((dia) => ({
    ...dia,
    ejercicios: dia.ejercicios.filter((ej) => safeIds.has(ej.exercise_id)),
  }));
}
