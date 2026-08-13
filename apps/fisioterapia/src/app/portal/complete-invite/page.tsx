'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';

export default function CompleteInvitePage() {
  const router = useRouter();

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    if (!accessToken || !refreshToken) {
      router.replace('/login');
      return;
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    );

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        router.replace(error ? '/login' : '/portal');
      });
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Verificando acceso…</p>
    </div>
  );
}
