import { createSupabaseClient } from '@/supabase-clients/server';
import { createAdminClient } from '@/supabase-clients/admin';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppSidebar } from './app-sidebar';

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
  const [profileRes, employeeRes] = await Promise.all([
    admin.from('profiles').select('business_id').eq('user_id', user!.id).maybeSingle(),
    admin.from('employee_auth').select('employee_id').eq('user_id', user!.id).maybeSingle(),
  ]);

  const businessId = profileRes.data?.business_id;
  const isGymUser = !!businessId || !!employeeRes.data?.employee_id;

  if (!isGymUser) {
    const { data: clientLink } = await admin
      .from('gym_client_users')
      .select('gym_client_id')
      .eq('auth_user_id', user!.id)
      .maybeSingle();

    redirect(clientLink ? '/portal' : '/login');
  }

  if (businessId) {
    const { data: svc } = await admin
      .from('business_services')
      .select('service')
      .eq('business_id', businessId)
      .eq('service', 'gym')
      .maybeSingle();
    if (!svc) redirect('/login');
  }

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <AuthGuard>{children}</AuthGuard>
      </main>
    </div>
  );
}
