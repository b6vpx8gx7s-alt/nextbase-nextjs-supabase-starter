import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

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
    }
  );

  const allCookies = request.cookies.getAll()
  console.log('[middleware] Cookies recibidos:', allCookies.map(c => c.name));
  console.log('[middleware] SUPABASE_URL defined:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[middleware] PUBLISHABLE_KEY defined:', !!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);

  // Log first 60 chars of cookie value to check encoding format
  const sessionCookie = allCookies.find(c => c.name.includes('auth-token'))
  if (sessionCookie) {
    console.log('[middleware] Cookie value prefix:', sessionCookie.value.substring(0, 60))
  }

  const {
    data: { user },
    error: getUserError,
  } = await supabase.auth.getUser();

  console.log('[middleware] Session user:', user?.id ?? 'NULL');
  if (getUserError) {
    console.log('[middleware] getUser error:', getUserError.message, getUserError.status);
  }

  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/pacientes');

  if (!user && isProtected) {
    if (process.env.NODE_ENV === 'production') {
      // Pass the exact fisioterapia URL so roda.ink/auth/callback redirects back here
      const loginUrl = new URL('https://www.roda.ink/login')
      loginUrl.searchParams.set('next', request.nextUrl.href)
      console.log('[middleware] Redirecting to www.roda.ink/login with next:', request.nextUrl.href);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}
