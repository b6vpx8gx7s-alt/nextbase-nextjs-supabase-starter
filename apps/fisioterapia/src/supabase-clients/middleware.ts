import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const cookieDomain = process.env.NODE_ENV === 'production' ? '.roda.ink' : undefined;

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
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            })
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = pathname.startsWith('/dashboard') || pathname.startsWith('/pacientes');

  if (!user && isProtected) {
    const loginUrl = process.env.NODE_ENV === 'production'
      ? 'https://roda.ink/login'
      : '/login';
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
