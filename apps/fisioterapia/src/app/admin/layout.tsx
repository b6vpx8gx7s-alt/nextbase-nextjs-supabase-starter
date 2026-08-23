import { redirect } from 'next/navigation';
import { createFisioClient, requireSuperAdmin } from '@/app/api/fisio/_helpers';
import type { ReactNode } from 'react';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const supabase = await createFisioClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect('/login');
  if (!(await requireSuperAdmin(user.id))) redirect('/dashboard');

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b px-6 py-4">
        <span className="text-sm font-semibold">
          Panel Admin · fisioterapia<span className="text-primary">.</span>roda.ink
        </span>
      </header>
      <main className="max-w-4xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
