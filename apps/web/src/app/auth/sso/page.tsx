'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/supabase-clients/client';

export default function SSOPage() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function handleSSO() {
      const hash = window.location.hash.substring(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      if (!accessToken || !refreshToken) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.href = '/dashboard';
        } else {
          setErrorMsg('No se encontraron tokens de sesión en la URL.');
        }
        return;
      }

      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        setErrorMsg(`setSession falló: ${error.message}`);
        return;
      }

      window.history.replaceState(null, '', window.location.pathname);
      window.location.href = '/dashboard';
    }

    handleSSO();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (errorMsg) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16, padding: 24 }}>
        <p style={{ color: '#c00', fontWeight: 600 }}>No se pudo iniciar sesión automáticamente.</p>
        <p style={{ color: '#666', fontSize: 13, maxWidth: 400, textAlign: 'center' }}>{errorMsg}</p>
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
