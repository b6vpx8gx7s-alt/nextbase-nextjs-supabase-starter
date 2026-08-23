import { createFisioAdminClient } from '@/app/api/fisio/_helpers';
import { ExerciseApprovalList } from './ExerciseApprovalList';

export default async function SuggestedExercisesPage() {
  const admin = createFisioAdminClient();
  const { data, error } = await admin
    .from('exercises')
    .select('id, nombre, grupo_muscular, gif_url, businesses(name)')
    .eq('suggested_for_public', true)
    .eq('visibility', 'private')
    .order('nombre');

  if (error) {
    return <p className="text-sm text-destructive">Error al cargar ejercicios: {error.message}</p>;
  }

  const exercises = (data ?? []).map((ex) => ({
    id: ex.id as string,
    nombre: ex.nombre as string,
    grupo_muscular: ex.grupo_muscular as string,
    gif_url: (ex.gif_url as string | null) ?? null,
    business_name: (ex.businesses as unknown as { name: string } | null)?.name ?? null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Ejercicios sugeridos para el catálogo</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ejercicios privados marcados como sugeridos por los negocios. Apruébalos para hacerlos públicos.
        </p>
      </div>
      <ExerciseApprovalList initialExercises={exercises} />
    </div>
  );
}
