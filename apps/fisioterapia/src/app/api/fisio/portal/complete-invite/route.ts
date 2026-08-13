import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/supabase-clients/server';

// GET /api/fisio/portal/complete-invite?code=XXX
// Supabase redirects here after the patient accepts the invite email.
// Exchanges the PKCE code for a session and sends the patient to /portal.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    console.error('[complete-invite] No code in query string');
    return NextResponse.redirect(new URL('/login', origin));
  }

  const supabase = await createSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('[complete-invite] exchangeCodeForSession error:', error.message);
    return NextResponse.redirect(new URL('/login', origin));
  }

  const portalUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://fisioterapia.roda.ink/portal'
      : `${origin}/portal`;

  return NextResponse.redirect(portalUrl);
}
