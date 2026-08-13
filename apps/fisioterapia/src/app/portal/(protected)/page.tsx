import { createSupabaseClient } from '@/supabase-clients/server';
import { createFisioAdminClient } from '@/app/api/fisio/_helpers';
import { RoutineView } from '@/components/fisio/RoutineView';
import type { PhysioRoutine } from '@/lib/fisio-types';

export default async function PortalPage() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // layout.tsx already guards auth + patient link; user is always set here
  const { data: link } = await supabase
    .from('physio_client_users')
    .select('physio_client_id')
    .eq('auth_user_id', user!.id)
    .single();

  const admin = createFisioAdminClient();

  const [{ data: client }, { data: routines }] = await Promise.all([
    admin
      .from('physio_clients')
      .select('nombre, objetivo')
      .eq('id', link!.physio_client_id)
      .single(),
    admin
      .from('physio_routines')
      .select('*')
      .eq('client_id', link!.physio_client_id)
      .order('created_at', { ascending: false })
      .limit(1),
  ]);

  const routine = routines?.[0] as PhysioRoutine | undefined;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {client?.nombre ?? 'Paciente'}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tu plan de ejercicios personalizado
        </p>
      </div>

      {routine ? (
        <RoutineView routine={routine} />
      ) : (
        <div className="rounded-lg border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            Tu fisioterapeuta aún no ha generado un plan de ejercicios.
          </p>
        </div>
      )}
    </div>
  );
}
