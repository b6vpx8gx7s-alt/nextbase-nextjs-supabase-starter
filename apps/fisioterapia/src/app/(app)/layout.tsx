import { createSupabaseClient } from '@/supabase-clients/server';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppSidebar } from './app-sidebar';

async function AuthGuard({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl =
      process.env.NODE_ENV === 'production' ? 'https://www.roda.ink/login' : '/login';
    redirect(loginUrl);
  }

  // Check if this user is a fisio owner or employee
  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from('profiles').select('business_id').eq('user_id', user!.id).maybeSingle(),
    supabase.from('employee_auth').select('employee_id').eq('user_id', user!.id).maybeSingle(),
  ]);

  const isFisioUser = !!profile?.business_id || !!employee?.employee_id;

  if (!isFisioUser) {
    // Not a fisio owner/employee — if they're a linked patient, send them to /portal
    const { data: patientLink } = await supabase
      .from('physio_client_users')
      .select('physio_client_id')
      .eq('auth_user_id', user!.id)
      .maybeSingle();

    redirect(patientLink ? '/portal' : '/login');
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
