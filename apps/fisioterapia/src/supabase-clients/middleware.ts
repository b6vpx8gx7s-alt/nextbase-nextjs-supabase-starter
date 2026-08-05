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

  console.log('[middleware] Cookies recibidos:', request.cookies.getAll().map(c => c.name));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log('[middleware] Session user:', user?.id ?? 'NULL');

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
