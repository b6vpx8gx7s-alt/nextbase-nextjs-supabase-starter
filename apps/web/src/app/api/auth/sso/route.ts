import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const cookieDomain = process.env.NODE_ENV === 'production' ? '.roda.ink' : undefined;

export async function POST(request: NextRequest) {
  try {
    const { access_token, refresh_token } = await request.json();

    if (!access_token || !refresh_token) {
      return Response.json({ error: 'Missing tokens' }, { status: 400 });
    }

    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(cookieDomain ? { domain: cookieDomain } : {}),
              })
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });

    if (error) {
      console.error('[SSO API] setSession error:', error.message);
      return Response.json({ error: error.message }, { status: 401 });
    }

    console.log('[SSO API] setSession OK — user:', data.user?.id);
    return Response.json({ ok: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    console.error('[SSO API] Unexpected error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
}
