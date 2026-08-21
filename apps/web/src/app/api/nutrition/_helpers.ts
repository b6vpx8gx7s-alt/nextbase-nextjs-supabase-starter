import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/supabase-clients/admin'

export type UserContext = {
  userId: string
  businessId: string
  employeeId: string | null
  role: 'owner' | 'employee'
}

const cookieDomain = process.env.NODE_ENV === 'production' ? '.roda.ink' : undefined

export async function createNutritionClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(s) {
          s.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, ...(cookieDomain ? { domain: cookieDomain } : {}) })
          )
        },
      },
    }
  )
}

// Returns the Supabase client and the resolved user context in one call.
// Auth is validated with the anon client; profile queries use the admin client to bypass RLS.
export async function getClientAndContext() {
  const supabase = await createNutritionClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError) {
    console.error('[nutrition/_helpers] auth.getUser error:', authError.message)
    return { supabase, ctx: null } as const
  }

  if (!user) return { supabase, ctx: null } as const

  const admin = createAdminClient()
  const [profileRes, employeeRes] = await Promise.all([
    admin.from('profiles').select('business_id').eq('user_id', user.id).maybeSingle(),
    admin.from('employee_auth').select('employee_id').eq('user_id', user.id).maybeSingle(),
  ])

  if (profileRes.error) {
    console.error('[nutrition/_helpers] profiles query error:', profileRes.error.message, profileRes.error.code)
  }

  if (!profileRes.data?.business_id) {
    console.error('[nutrition/_helpers] No business_id for user:', user.id)
    return { supabase, ctx: null } as const
  }

  const employeeId: string | null = employeeRes.data?.employee_id ?? null

  const ctx: UserContext = {
    userId: user.id,
    businessId: profileRes.data.business_id,
    employeeId,
    role: employeeId ? 'employee' : 'owner',
  }

  return { supabase, ctx }
}
