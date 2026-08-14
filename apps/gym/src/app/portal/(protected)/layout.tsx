import { redirect } from 'next/navigation';
import { createSupabaseClient } from '@/supabase-clients/server';
import type { ReactNode } from 'react';

export default async function ProtectedPortalLayout({ children }: { children: ReactNode }) {
  const supabase = await createSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl =
      process.env.NODE_ENV === 'production' ? 'https://www.roda.ink/login' : '/login';
    redirect(loginUrl);
  }

  const { data: link } = await supabase
    .from('gym_client_users')
    .select('gym_client_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (!link) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-sm">
          gym<span className="text-primary">.</span>roda.ink
        </span>
        <form action="/api/auth/signout" method="post">
          <button
            type="submit"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Cerrar sesión
          </button>
        </form>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
