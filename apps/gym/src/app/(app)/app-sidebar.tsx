import { createSupabaseClient } from '@/supabase-clients/server';
import { createAdminClient } from '@/supabase-clients/admin';
import { AppSidebarContent } from './app-sidebar-client';

export async function AppSidebar() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const admin = createAdminClient();
  const profileRes = await admin
    .from('profiles')
    .select('business_id')
    .eq('user_id', user.id)
    .maybeSingle();
  const businessId = profileRes.data?.business_id;

  let services: string[] = [];
  if (businessId) {
    const { data } = await admin
      .from('business_services')
      .select('service')
      .eq('business_id', businessId);
    services = (data ?? []).map((r: { service: string }) => r.service);
  }

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar h-screen sticky top-0">
      <AppSidebarContent user={user} services={services} />
    </aside>
  );
}
