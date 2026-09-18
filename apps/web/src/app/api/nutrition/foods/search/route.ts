import { NextRequest, NextResponse } from 'next/server'
import { getClientAndContext } from '../../_helpers'
import { createAdminClient } from '@/supabase-clients/admin'

export async function GET(request: NextRequest) {
  try {
    const { ctx } = await getClientAndContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const q = request.nextUrl.searchParams.get('q')?.trim() ?? ''
    if (!q) return NextResponse.json([])

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('nutrition_food_suggestions')
      .select('id, nombre, categoria, calorias, proteina, carbohidratos, grasa, unidad')
      .eq('status', 'approved')
      .eq('business_id', ctx.businessId)
      .ilike('nombre', `%${q}%`)
      .limit(10)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Normalize to English field names matching the Food interface used by PlanEditor
    const results = (data ?? []).map((f: Record<string, unknown>) => ({
      id: f.id as string,
      name: f.nombre as string,
      category: (f.categoria as string | null) ?? '',
      calories: (f.calorias as number) ?? 0,
      protein: (f.proteina as number) ?? 0,
      carbs: (f.carbohidratos as number) ?? 0,
      fat: (f.grasa as number) ?? 0,
      unit: (f.unidad as string | null) ?? 'g',
    }))

    return NextResponse.json(results)
  } catch (err) {
    console.error('GET /api/nutrition/foods/search:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
