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

  console.log('[AuthGuard] user.id:', user!.id);
  console.log('[AuthGuard] profileRes.data:', profileRes.data, '| error:', profileRes.error?.message ?? null);
  console.log('[AuthGuard] employeeRes.data:', employeeRes.data, '| error:', employeeRes.error?.message ?? null);

  const isGymUser = !!profileRes.data?.business_id || !!employeeRes.data?.employee_id;
  console.log('[AuthGuard] isGymUser:', isGymUser, '| business_id:', profileRes.data?.business_id ?? null);

  if (!isGymUser) {
    const { data: clientLink } = await admin
      .from('gym_client_users')
      .select('gym_client_id')
      .eq('auth_user_id', user!.id)
      .maybeSingle();

    console.log('[AuthGuard] → not a gym user, clientLink:', clientLink, '| redirecting to:', clientLink ? '/portal' : '/login');
    redirect(clientLink ? '/portal' : '/login');
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
