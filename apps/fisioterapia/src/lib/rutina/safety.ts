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
  clientId: string,
  supabase: SupabaseClient,
  businessId: string
): Promise<SafeExercise[]> {
  const [pathResult, painResult] = await Promise.all([
    supabase.from('pathologies').select('zona_corporal').eq('client_id', clientId),
    supabase.from('pain_map').select('zona_corporal, nivel').eq('client_id', clientId).gte('nivel', 4),
  ]);

  const userZoneStrings = [
    ...(pathResult.data ?? []).map((p: { zona_corporal: string }) => p.zona_corporal),
    ...(painResult.data ?? []).map((p: { zona_corporal: string }) => p.zona_corporal),
  ];

  let userCanonicalZones: string[] = [];
  if (userZoneStrings.length > 0) {
    const { data: aliases } = await supabase
      .from('zone_aliases')
      .select('zona_canonica')
      .in('zona_usuario', userZoneStrings);
    userCanonicalZones = [
      ...new Set((aliases ?? []).map((a: { zona_canonica: string }) => a.zona_canonica)),
    ];
  }

  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('id, nombre, patron, grupo_muscular, nivel, equipo, descripcion_breve, gif_url, exercise_restrictions(zona_corporal, severidad, motivo)')
    .or(`visibility.eq.public,business_id.eq.${businessId}`)
    .in('context', ['fisioterapia', 'ambos']);

  if (error || !exercises) throw new Error('Error fetching exercises: ' + error?.message);

  const safe: SafeExercise[] = [];

  for (const ex of exercises) {
    const restrictions: { zona_corporal: string; severidad: string; motivo: string }[] =
      (ex as { exercise_restrictions?: { zona_corporal: string; severidad: string; motivo: string }[] }).exercise_restrictions ?? [];

    const forbidden = restrictions.some(
      (r) => r.severidad === 'forbidden' && userCanonicalZones.includes(r.zona_corporal)
    );
    if (forbidden) continue;

    const caution_notes = restrictions
      .filter((r) => r.severidad === 'caution' && userCanonicalZones.includes(r.zona_corporal))
      .map((r) => r.motivo)
      .filter(Boolean);

    safe.push({
      id: (ex as { id: string }).id,
      nombre: (ex as { nombre: string }).nombre,
      patron: (ex as { patron: string }).patron ?? '',
      grupo_muscular: (ex as { grupo_muscular: string }).grupo_muscular ?? '',
      nivel: (ex as { nivel: string }).nivel ?? '',
      equipo: (ex as { equipo: string }).equipo ?? '',
      descripcion_breve: (ex as { descripcion_breve: string }).descripcion_breve ?? '',
      gif_url: (ex as { gif_url?: string | null }).gif_url ?? null,
      caution_notes,
    });
  }

  return safe;
}

/**
 * Returns ALL exercises (including forbidden ones) with per-patient
 * restriction flags so the manual builder can show 🚫/⚠️ badges.
 */
export async function getAllExercisesWithFlags(
  clientId: string,
  supabase: SupabaseClient,
  businessId: string
): Promise<ExerciseWithFlags[]> {
  const [pathResult, painResult] = await Promise.all([
    supabase.from('pathologies').select('zona_corporal').eq('client_id', clientId),
    supabase.from('pain_map').select('zona_corporal, nivel').eq('client_id', clientId).gte('nivel', 4),
  ]);

  const userZoneStrings = [
    ...(pathResult.data ?? []).map((p: { zona_corporal: string }) => p.zona_corporal),
    ...(painResult.data ?? []).map((p: { zona_corporal: string }) => p.zona_corporal),
  ];

  let userCanonicalZones: string[] = [];
  if (userZoneStrings.length > 0) {
    const { data: aliases } = await supabase
      .from('zone_aliases')
      .select('zona_canonica')
      .in('zona_usuario', userZoneStrings);
    userCanonicalZones = [
      ...new Set((aliases ?? []).map((a: { zona_canonica: string }) => a.zona_canonica)),
    ];
  }

  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('id, nombre, patron, grupo_muscular, nivel, equipo, descripcion_breve, exercise_restrictions(zona_corporal, severidad, motivo)')
    .or(`visibility.eq.public,business_id.eq.${businessId}`)
    .in('context', ['fisioterapia', 'ambos'])
    .order('grupo_muscular')
    .order('nombre');

  if (error || !exercises) throw new Error('Error fetching exercises: ' + error?.message);

  return exercises.map((ex) => {
    const restrictions: { zona_corporal: string; severidad: string; motivo: string }[] =
      (ex as { exercise_restrictions?: { zona_corporal: string; severidad: string; motivo: string }[] }).exercise_restrictions ?? [];

    const forbidden = restrictions.some(
      (r) => r.severidad === 'forbidden' && userCanonicalZones.includes(r.zona_corporal)
    );
    const caution_notes = restrictions
      .filter((r) => r.severidad === 'caution' && userCanonicalZones.includes(r.zona_corporal))
      .map((r) => r.motivo)
      .filter(Boolean);

    return {
      id: (ex as { id: string }).id,
      nombre: (ex as { nombre: string }).nombre,
      patron: (ex as { patron: string }).patron ?? '',
      grupo_muscular: (ex as { grupo_muscular: string }).grupo_muscular ?? '',
      nivel: (ex as { nivel: string }).nivel ?? '',
      equipo: (ex as { equipo: string }).equipo ?? '',
      descripcion_breve: (ex as { descripcion_breve: string }).descripcion_breve ?? '',
      gif_url: (ex as { gif_url?: string | null }).gif_url ?? null,
      forbidden,
      caution_notes,
    };
  });
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
