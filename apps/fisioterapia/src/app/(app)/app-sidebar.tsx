import { createSupabaseClient } from '@/supabase-clients/server';
import { AppSidebarContent } from './app-sidebar-client';

export async function AppSidebar() {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r bg-sidebar h-screen sticky top-0">
      <AppSidebarContent user={user} />
    </aside>
  );
}
