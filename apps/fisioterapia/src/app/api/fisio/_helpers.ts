import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export type UserContext = {
  userId: string;
  businessId: string;
  employeeId: string | null;
  role: 'owner' | 'employee';
};

const cookieDomain = process.env.NODE_ENV === 'production' ? '.roda.ink' : undefined;

export async function createFisioClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(s) {
          s.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, {
              ...options,
              ...(cookieDomain ? { domain: cookieDomain } : {}),
            })
          );
        },
      },
    }
  );
}

export async function getClientAndContext() {
  const supabase = await createFisioClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, ctx: null } as const;

  const [profileRes, employeeRes] = await Promise.all([
    supabase.from('profiles').select('business_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('employee_auth').select('employee_id').eq('user_id', user.id).maybeSingle(),
  ]);

  if (!profileRes.data?.business_id) return { supabase, ctx: null } as const;

  const employeeId: string | null = employeeRes.data?.employee_id ?? null;
  const ctx: UserContext = {
    userId: user.id,
    businessId: profileRes.data.business_id,
    employeeId,
    role: employeeId ? 'employee' : 'owner',
  };

  return { supabase, ctx };
}
