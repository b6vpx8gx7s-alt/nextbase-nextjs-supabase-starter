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
import { getNutriAIBusinessContext } from '@/lib/nutrai-business';
import { NutriAIPanel } from '@/components/NutriAIPanel';

async function AuthGuard({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  // [DEBUG-SSO] Remove once SSO session issue is resolved
  console.error('[AuthGuard] getUser result:', {
    userId: user?.id ?? null,
    email: user?.email ?? null,
    supabaseError: userError?.message ?? null,
  });

  if (!user) {
    console.error('[AuthGuard] redirect → /login (no user from getUser)');
    redirect('/login');
  }

  const admin = createAdminClient();
  const [profileRes, employeeRes] = await Promise.all([
    admin.from('profiles').select('business_id').eq('user_id', user.id).maybeSingle(),
    admin.from('employee_auth').select('employee_id').eq('user_id', user.id).maybeSingle(),
  ]);

  const businessId = profileRes.data?.business_id;

  console.error('[AuthGuard] profile check:', {
    userId: user.id,
    businessId: businessId ?? null,
    profileError: profileRes.error?.message ?? null,
    employeeId: employeeRes.data?.employee_id ?? null,
    employeeError: employeeRes.error?.message ?? null,
  });

  if (!businessId && !employeeRes.data?.employee_id) {
    console.error('[AuthGuard] redirect → /login (no businessId and no employeeId)');
    redirect('/login');
  }

  if (businessId) {
    // Nutrition is a gym add-on: the base business must be 'gym' AND must
    // have 'nutricion' explicitly in business_services. Both checks are
    // required — the second alone is not enough because a manual INSERT into
    // business_services could otherwise grant access to a non-gym business.
    const [bizRes, svcRes] = await Promise.all([
      admin.from('businesses').select('category').eq('id', businessId).maybeSingle(),
      admin.from('business_services').select('service').eq('business_id', businessId).eq('service', 'nutricion').maybeSingle(),
    ]);

    console.error('[AuthGuard] business check:', {
      businessId,
      category: bizRes.data?.category ?? null,
      bizError: bizRes.error?.message ?? null,
      hasNutricion: !!svcRes.data,
      svcError: svcRes.error?.message ?? null,
    });

    if (bizRes.data?.category !== 'gym' || !svcRes.data) {
      console.error('[AuthGuard] redirect → /login (category !== gym or no nutricion service)', {
        category: bizRes.data?.category,
        hasNutricion: !!svcRes.data,
      });
      redirect('/login');
    }
  }

  return <>{children}</>;
}

async function NutriAIPanelLoader() {
  const supabase = await createSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    const context = await getNutriAIBusinessContext(user.id);
    return <NutriAIPanel context={context} />;
  } catch {
    return null;
  }
}

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
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
      <Suspense fallback={null}>
        <NutriAIPanelLoader />
      </Suspense>
    </>
  );
}
