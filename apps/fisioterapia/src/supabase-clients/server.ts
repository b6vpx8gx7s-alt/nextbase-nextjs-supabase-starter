import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const cookieDomain = process.env.NODE_ENV === 'production' ? '.roda.ink' : undefined;

export const createSupabaseClient = async () => {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, {
                ...options,
                ...(cookieDomain ? { domain: cookieDomain } : {}),
              })
            );
          } catch {
            // Called from a Server Component — middleware handles refresh.
          }
        },
      },
    }
  );
};
