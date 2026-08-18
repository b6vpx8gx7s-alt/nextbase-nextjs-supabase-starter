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

  console.log('[AuthGuard] getUser() result:', {
    hasUser: !!user,
    userId: user?.id,
    userEmail: user?.email,
  });

  if (!user) {
    redirect('/login');
  }

  // Use service-role client so RLS never silently blocks these reads.
  console.log('[AuthGuard] step: creating admin client');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let admin: any;
  try {
    admin = createAdminClient();
    console.log('[AuthGuard] step: admin client created OK');
  } catch (e) {
    console.error('[AuthGuard] createAdminClient threw:', e instanceof Error ? e.message : String(e));
    redirect('/login');
  }

  console.log('[AuthGuard] step: running profiles + employee_auth queries');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let profileRes: any, employeeRes: any;
  try {
    [profileRes, employeeRes] = await Promise.all([
      admin.from('profiles').select('business_id').eq('user_id', user!.id).maybeSingle(),
      admin.from('employee_auth').select('employee_id').eq('user_id', user!.id).maybeSingle(),
    ]);
    console.log('[AuthGuard] step: queries resolved');
  } catch (e) {
    console.error('[AuthGuard] Promise.all threw:', e instanceof Error ? e.message : String(e));
    redirect('/login');
  }

  console.log('[AuthGuard] profiles query:', {
    error: profileRes?.error?.message,
    hasData: !!profileRes?.data,
    businessId: profileRes?.data?.business_id,
  });

  console.log('[AuthGuard] employee_auth query:', {
    error: employeeRes?.error?.message,
    hasData: !!employeeRes?.data,
    employeeId: employeeRes?.data?.employee_id,
  });

  const isGymUser = !!profileRes?.data?.business_id || !!employeeRes?.data?.employee_id;
  console.log('[AuthGuard] isGymUser:', isGymUser);

  if (!isGymUser) {
    console.log('[AuthGuard] step: checking gym_client_users');
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
