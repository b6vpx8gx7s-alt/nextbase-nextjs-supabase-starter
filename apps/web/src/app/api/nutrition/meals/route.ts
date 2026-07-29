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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('business_id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (!profile?.business_id) return NextResponse.json({ error: 'No business found' }, { status: 400 })

    const body = await request.json()
    const { plan_id, meals } = body as {
      plan_id: string
      meals: Array<{
        day: number
        meal_type: string
        foods?: unknown
        macros?: unknown
        notes?: string
      }>
    }

    if (!plan_id || !Array.isArray(meals)) {
      return NextResponse.json({ error: 'plan_id and meals required' }, { status: 400 })
    }

    const { data: plan } = await supabase
      .from('nutrition_plans')
      .select('id')
      .eq('id', plan_id)
      .eq('business_id', profile.business_id)
      .maybeSingle()
    if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

    await supabase.from('nutrition_plan_meals').delete().eq('plan_id', plan_id)

    const rows = meals.map(m => ({
      plan_id,
      day: m.day,
      meal_type: m.meal_type,
      foods: m.foods ?? [],
      macros: m.macros ?? null,
      notes: m.notes ?? null,
    }))

    const { data, error } = await supabase
      .from('nutrition_plan_meals')
      .insert(rows)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('Error saving meals:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
