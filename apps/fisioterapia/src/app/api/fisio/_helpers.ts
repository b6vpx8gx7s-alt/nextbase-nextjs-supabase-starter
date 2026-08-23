import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export type UserContext = {
  userId: string;
  businessId: string;
  employeeId: string | null;
  role: 'owner' | 'employee';
};

const cookieDomain = process.env.NODE_ENV === 'production' ? '.roda.ink' : undefined;

export async function createFisioClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    const missing = [!url && 'NEXT_PUBLIC_SUPABASE_URL', !key && 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
      .filter(Boolean)
      .join(', ');
    throw new Error(`[fisio/_helpers] Missing env vars: ${missing}`);
  }

  const cookieStore = await cookies();

  return createServerClient(url, key, {
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
          // In Server Components cookies are read-only; middleware handles refresh.
        }
      },
    },
  });
}

// Service-role client for server-side mutations — bypasses RLS.
// Only use after validating identity with getClientAndContext().
export function createFisioAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('[fisio/_helpers] Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function requireSuperAdmin(userId: string): Promise<boolean> {
  const supabase = createFisioAdminClient();
  const { data } = await supabase
    .from('super_admins')
    .select('id')
    .eq('user_id', userId)
    .eq('active', true)
    .maybeSingle();
  return !!data;
}

export async function getClientAndContext() {
  const supabase = await createFisioClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error('[fisio/_helpers] auth.getUser error:', authError.message);
    return { supabase, ctx: null } as const;
  }

  if (!user) return { supabase, ctx: null } as const;

  const [profileRes, employeeRes] = await Promise.all([
    supabase.from('profiles').select('business_id').eq('user_id', user.id).maybeSingle(),
    supabase.from('employee_auth').select('employee_id').eq('user_id', user.id).maybeSingle(),
  ]);

  if (profileRes.error) {
    console.error('[fisio/_helpers] profiles query error:', profileRes.error.message, profileRes.error.code);
  }

  if (!profileRes.data?.business_id) {
    console.error('[fisio/_helpers] No business_id for user:', user.id);
    return { supabase, ctx: null } as const;
  }

  const employeeId: string | null = employeeRes.data?.employee_id ?? null;
  const ctx: UserContext = {
    userId: user.id,
    businessId: profileRes.data.business_id,
    employeeId,
    role: employeeId ? 'employee' : 'owner',
  };

  return { supabase, ctx };
}
