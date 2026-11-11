import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Parse the access token expiry from the Supabase auth cookie without a
// network call. Returns null if the cookie is missing or unparseable.
function getAccessTokenExp(request: NextRequest): number | null {
  const cookie = request.cookies.getAll()
    .find(c => /^sb-[^-]+-auth-token$/.test(c.name));
  if (!cookie) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(cookie.value));
    // Cookie value is either {access_token, ...} or [[key, {access_token, ...}], ...]
    const at: string | undefined = Array.isArray(parsed)
      ? parsed?.[0]?.[1]?.access_token
      : parsed?.access_token;
    if (!at) return null;
    const { exp } = JSON.parse(atob(at.split('.')[1]));
    return typeof exp === 'number' ? exp : null;
  } catch {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              domain: '.roda.ink',
            })
          );
        },
      },
      cookieOptions: {
        domain: '.roda.ink',
        path: '/',
        sameSite: 'lax',
        secure: true,
      },
    }
  );

  const pathname = request.nextUrl.pathname;
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/clientes') ||
    (pathname.startsWith('/portal') && pathname !== '/portal/complete-invite');

  // Only call getUser() (hits Supabase API + may rotate refresh token) when
  // the access token is actually expired or within 10 s of expiry. This prevents
  // concurrent requests — Next.js App Router can send several simultaneously —
  // from all racing to exchange the same refresh token (refresh_token_already_used).
  // When the token is still fresh, getSession() reads the cookie locally.
  const exp = getAccessTokenExp(request);
  const tokenExpired = !exp || exp < (Date.now() / 1000) + 10;

  if (tokenExpired) {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    // Stale refresh token: clear all sb-* cookies (both with and without the
    // .roda.ink domain) so the browser doesn't loop forever on a bad cookie.
    if (authError?.code === 'refresh_token_not_found') {
      const loginUrl = process.env.NODE_ENV === 'production'
        ? new URL('https://www.roda.ink/login')
        : new URL('/login', request.url);
      const res = NextResponse.redirect(loginUrl);
      request.cookies.getAll()
        .filter(({ name }) => name.startsWith('sb-'))
        .forEach(({ name }) => {
          res.cookies.set(name, '', { maxAge: 0, path: '/' });
          res.cookies.set(name, '', { maxAge: 0, path: '/', domain: '.roda.ink' });
        });
      return res;
    }

    // A concurrent request already exchanged this refresh token. The new tokens
    // are being written — pass through so the browser's Supabase client syncs them.
    if (authError?.code === 'refresh_token_already_used') {
      return supabaseResponse;
    }

    if (!user && isProtected) {
      if (process.env.NODE_ENV === 'production') {
        const loginUrl = new URL('https://www.roda.ink/login');
        loginUrl.searchParams.set('next', request.nextUrl.href);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } else {
    // Token is fresh — read session from cookie, no network call, no race risk.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session && isProtected) {
      if (process.env.NODE_ENV === 'production') {
        const loginUrl = new URL('https://www.roda.ink/login');
        loginUrl.searchParams.set('next', request.nextUrl.href);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  return supabaseResponse;
}
