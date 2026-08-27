import { createSupabaseClient } from '@/supabase-clients/server';
import { createGymAdminClient } from '@/app/api/gym/_helpers';
import { WorkoutLogger } from './WorkoutLogger';
import type { PhysioRoutine } from '@/lib/fisio-types';

export default async function PortalPage() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // layout.tsx already guards auth + client link; user is always set here
  const { data: link } = await supabase
    .from('gym_client_users')
    .select('gym_client_id')
    .eq('auth_user_id', user!.id)
    .single();

  const admin = createGymAdminClient();

  const [{ data: client }, { data: routines }] = await Promise.all([
    admin
      .from('gym_clients')
      .select('nombre, objetivo_principal')
      .eq('id', link!.gym_client_id)
      .single(),
    admin
      .from('gym_routines')
      .select('*')
      .eq('client_id', link!.gym_client_id)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const routine = routines?.[0] as PhysioRoutine | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {client?.nombre ?? 'Atleta'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tu plan de entrenamiento personalizado
        </p>
      </div>

      {routine ? (
        <WorkoutLogger routine={routine} />
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Tu entrenador aún no ha generado un plan de ejercicios.
          </p>
        </div>
      )}
    </div>
  );
}
