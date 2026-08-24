'use client';

// This page reads tokens from the URL hash at runtime — never prerender it.
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { createClient } from '@/supabase-clients/client';

export default function SSOPage() {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function handleSSO() {
      // Parse tokens from the URL hash
      const hash = window.location.hash.substring(1); // strip leading '#'
      const params = new URLSearchParams(hash);
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');

      console.log('[SSO] hash params:', {
        hasAccessToken: !!accessToken,
        hasRefreshToken: !!refreshToken,
        rawHash: hash.slice(0, 80) + (hash.length > 80 ? '…' : ''),
      });

      if (!accessToken || !refreshToken) {
        // No tokens in hash — maybe the user navigated here directly
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          window.location.href = '/dashboard';
        } else {
          setErrorMsg('No se encontraron tokens de sesión en la URL.');
        }
        return;
      }

      // Explicitly set the session using the tokens from the hash
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (error) {
        console.error('[SSO] setSession error:', error.message, error);
        setErrorMsg(`setSession falló: ${error.message}`);
        return;
      }

      console.log('[SSO] setSession OK — user:', data.user?.id, '| expires_at:', data.session?.expires_at);

      // Clean the hash from the browser history
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
