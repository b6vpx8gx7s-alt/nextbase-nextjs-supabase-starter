'use client';

import { createBrowserClient } from '@supabase/ssr';

const isProd = process.env.NODE_ENV === 'production';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookieOptions: isProd
        ? { domain: '.roda.ink', path: '/', sameSite: 'lax', secure: true }
        : undefined,
    }
  );
}
