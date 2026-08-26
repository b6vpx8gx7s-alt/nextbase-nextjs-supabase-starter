import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { match } from 'path-to-regexp';

const cookieDomain = process.env.NODE_ENV === 'production' ? '.roda.ink' : undefined;

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, { ...options, ...(cookieDomain ? { domain: cookieDomain } : {}) })
          );
        },
      },
    }
  );

  // IMPORTANT: Avoid adding logic between createServerClient and
  // supabase.auth.getUser(). Extra work here can make session refresh bugs hard
  // to diagnose.

  const protectedPages = [
    '/nutrition',
    '/private-item',
    '/private-items',
    '/items',
    '/item',
  ] as const;

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
        if (cookieDomain) res.cookies.set(name, '', { maxAge: 0, path: '/', domain: cookieDomain });
      });
    return res;
  }

  const pathname = request.nextUrl.pathname;
  const isProtected =
    pathname.startsWith('/dashboard') ||
    protectedPages.some((page) => match(page)(pathname));

  if (!user && isProtected) {
    if (process.env.NODE_ENV === 'production') {
      const loginUrl = new URL('https://www.roda.ink/login');
      loginUrl.searchParams.set('next', request.nextUrl.href);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}
