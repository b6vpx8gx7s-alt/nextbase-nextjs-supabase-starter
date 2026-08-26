import { Separator } from '@/components/ui/separator';
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { createSupabaseClient } from '@/supabase-clients/server';
import { createAdminClient } from '@/supabase-clients/admin';
import { redirect } from 'next/navigation';
import { type ReactNode, Suspense } from 'react';
import { AppSidebar } from './app-sidebar';
import { DynamicBreadcrumb } from '@/components/dynamic-breadcrumb';

async function AuthGuard({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const admin = createAdminClient();
  const [profileRes, employeeRes] = await Promise.all([
    admin.from('profiles').select('business_id').eq('user_id', user.id).maybeSingle(),
    admin.from('employee_auth').select('employee_id').eq('user_id', user.id).maybeSingle(),
  ]);

  if (!profileRes.data?.business_id && !employeeRes.data?.employee_id) {
    redirect('/login');
  }

  return <>{children}</>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 h-4" />
          <Suspense fallback={null}>
            <DynamicBreadcrumb />
          </Suspense>
        </header>
        <Suspense fallback={null}>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  );
}
