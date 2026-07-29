import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(s) { s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    }
  )
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string }> }
) {
  try {
    const { planId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile?.business_id) return NextResponse.json({ error: 'No business found' }, { status: 400 })

    const { data: plan } = await supabase
      .from('nutrition_plans')
      .select('id')
      .eq('id', planId)
      .eq('business_id', profile.business_id)
      .maybeSingle()
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('nutrition_plan_meals')
      .select('*')
      .eq('plan_id', planId)
      .order('day', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error fetching meals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
