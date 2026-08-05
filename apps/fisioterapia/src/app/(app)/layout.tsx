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
