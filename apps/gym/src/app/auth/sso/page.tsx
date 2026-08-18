'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/supabase-clients/client';

export default function SSOPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const supabase = createClient();

  useEffect(() => {
    let redirected = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && !redirected) {
        redirected = true;
        router.replace('/dashboard');
      }
    });

    // Check if session was already picked up from hash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !redirected) {
        redirected = true;
        router.replace('/dashboard');
      }
    });

    // Fallback: if no session established after 6s, go to login
    const timeout = setTimeout(() => {
      if (!redirected) {
        setStatus('error');
      }
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'error') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 }}>
        <p style={{ color: '#555' }}>No se pudo iniciar sesión automáticamente.</p>
        <a href="/login" style={{ color: '#1B8BA8', textDecoration: 'underline' }}>Ir al inicio de sesión</a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <p style={{ color: '#555' }}>Iniciando sesión...</p>
    </div>
  );
}
