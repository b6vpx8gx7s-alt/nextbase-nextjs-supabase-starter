import { NextRequest, NextResponse } from 'next/server'
import { getClientAndContext } from '../../_helpers'
import { createAdminClient } from '@/supabase-clients/admin'

export async function POST(request: NextRequest) {
  try {
    const { ctx } = await getClientAndContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const admin = createAdminClient()

    const { error } = await admin.from('nutrition_food_suggestions').insert({
      nombre:        body.nombre,
      categoria:     body.categoria     ?? null,
      calorias:      body.calorias      ?? null,
      proteina:      body.proteina      ?? null,
      carbohidratos: body.carbohidratos ?? null,
      grasa:         body.grasa         ?? null,
      unidad:        body.unidad        ?? 'g',
      fuente:        body.fuente        ?? 'personalizado',
      fdc_id:        body.fdc_id        ?? null,
      business_id:   ctx.businessId,
      created_by:    ctx.userId,
      status:        'pending',
    })

    if (error) {
      console.error('[foods/suggest] insert error:', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    console.error('POST /api/nutrition/foods/suggest:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
