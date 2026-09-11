import { ClientList } from '@/components/fisio/ClientList';
import { AlertCenter } from '@/components/AlertCenter';
import { createSupabaseClient } from '@/supabase-clients/server';
import { getRodaAIBusinessContext } from '@/lib/rodaai-business';

export default async function DashboardPage() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let userRole: 'trainer' | 'client' = 'trainer';
  if (user) {
    try {
      const ctx = await getRodaAIBusinessContext(user.id);
      userRole = ctx.userRole;
    } catch {
      // sin contexto: asumir trainer (el AuthGuard ya validó el acceso)
    }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona los planes de entrenamiento de tus clientes.
        </p>
      </div>
      <AlertCenter userRole={userRole} />
      <ClientList />
    </div>
  );
}
