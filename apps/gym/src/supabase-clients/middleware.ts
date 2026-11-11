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
      cookieOptions: {
        domain: '.roda.ink',
        path: '/',
        sameSite: 'lax',
        secure: true,
      },
    }
  );

  // Use getSession() to validate token WITHOUT refreshing (avoids refresh_token_already_used)
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const user = session?.user;

  const pathname = request.nextUrl.pathname;
  const isProtected =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/clientes') ||
    (pathname.startsWith('/portal') && pathname !== '/portal/complete-invite');

  if (!user && isProtected) {
    if (process.env.NODE_ENV === 'production') {
      const loginUrl = new URL('https://www.roda.ink/login')
      loginUrl.searchParams.set('next', request.nextUrl.href)
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return supabaseResponse;
}
