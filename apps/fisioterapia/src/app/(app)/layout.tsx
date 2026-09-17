import { createSupabaseClient } from '@/supabase-clients/server';
import { createAdminClient } from '@/supabase-clients/admin';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppSidebar } from './app-sidebar';
import { FisioAIPanel } from '@/components/FisioAIPanel';
import { getFisioAIBusinessContext, type FisioAIBusinessContext } from '@/lib/fisioai-business';

async function AuthGuard({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Use service-role client so RLS never silently blocks these reads.
  const admin = createAdminClient();
  const [{ data: profile }, { data: employee }] = await Promise.all([
    admin.from('profiles').select('business_id').eq('user_id', user!.id).maybeSingle(),
    admin.from('employee_auth').select('employee_id').eq('user_id', user!.id).maybeSingle(),
  ]);

  const isFisioUser = !!profile?.business_id || !!employee?.employee_id;

  if (!isFisioUser) {
    const { data: patientLink } = await admin
      .from('physio_client_users')
      .select('physio_client_id')
      .eq('auth_user_id', user!.id)
      .maybeSingle();

    redirect(patientLink ? '/portal' : '/login');
  }

  return <>{children}</>;
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fisioaiContext: FisioAIBusinessContext | null = null;
  if (user) {
    try {
      fisioaiContext = await getFisioAIBusinessContext(user.id);
    } catch {
      // Sin contexto válido: panel no se muestra
    }
  }

  return (
    <>
      <div className="flex min-h-screen">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <AuthGuard>{children}</AuthGuard>
        </main>
      </div>
      {fisioaiContext && <FisioAIPanel context={fisioaiContext} />}
    </>
  );
}
