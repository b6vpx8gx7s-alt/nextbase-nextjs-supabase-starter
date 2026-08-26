
import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar';
import { getCachedLoggedInVerifiedSupabaseUser } from '@/rsc-data/supabase';
import { createAdminClient } from '@/supabase-clients/admin';
import Link from 'next/link';
import { Suspense } from 'react';
import { AppSidebarContent } from './app-sidebar-client';



async function SidebarHeaderContent() {
  'use cache'
  return <SidebarHeader>
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" asChild>
          <Link href="/nutrition">
            <div className="flex aspect-square size-8 items-center justify-center rounded-lg" style={{ background: '#3DD9B0' }}>
              <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '0.65rem', color: '#0F2730', letterSpacing: '-0.02em' }}>
                RODA
              </span>
            </div>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-bold" style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}>
                RODA<span style={{ color: '#3DD9B0' }}>.</span>ink
              </span>
              <span className="truncate text-xs" style={{ color: 'oklch(0.87 0 0 / 55%)' }}>
                Planes Nutricionales
              </span>
            </div>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  </SidebarHeader>

}



async function SidebarContentWrapper() {
  const { user } = await getCachedLoggedInVerifiedSupabaseUser();

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

  return <AppSidebarContent user={user} services={services} />;
}


export async function AppSidebar() {
  return (
    <Sidebar variant="inset">
      <SidebarHeaderContent />
      <Suspense fallback={null}>
        <SidebarContentWrapper />
      </Suspense>
    </Sidebar>
  );
}
