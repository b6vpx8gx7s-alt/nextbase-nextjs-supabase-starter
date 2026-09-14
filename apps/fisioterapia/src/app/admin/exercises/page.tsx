import { createFisioAdminClient } from '@/app/api/fisio/_helpers';
import { AdminExerciseTabs } from './AdminExerciseTabs';

export default async function AdminExercisesPage() {
  const admin = createFisioAdminClient();

  const [exercisesResult, restrictionsResult] = await Promise.all([
    admin
      .from('exercises')
      .select('id, nombre, grupo_muscular, gif_url, businesses(name)')
      .eq('suggested_for_public', true)
      .eq('visibility', 'private')
      .order('nombre'),
    admin
      .from('exercise_restriction_suggestions')
      .select('id, exercise_id, exercise_nombre, zona_corporal, severidad, motivo')
      .eq('status', 'pending')
      .order('exercise_nombre'),
  ]);

  const pending = exercisesResult.error ? [] : (exercisesResult.data ?? []).map((ex) => ({
    id: ex.id as string,
    nombre: ex.nombre as string,
    grupo_muscular: ex.grupo_muscular as string,
    gif_url: (ex.gif_url as string | null) ?? null,
    business_name: (ex.businesses as unknown as { name: string } | null)?.name ?? null,
  }));

  const restrictions = restrictionsResult.error ? [] : (restrictionsResult.data ?? []).map((s) => ({
    id: s.id as string,
    exercise_id: s.exercise_id as string,
    exercise_nombre: s.exercise_nombre as string,
    zona_corporal: s.zona_corporal as string,
    severidad: s.severidad as 'forbidden' | 'caution',
    motivo: (s.motivo as string | null) ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Gestión de ejercicios</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aprueba sugerencias de negocios y administra el catálogo global.
        </p>
      </div>
      <AdminExerciseTabs initialPending={pending} initialRestrictions={restrictions} />
    </div>
  );
}
