import { NextRequest, NextResponse } from 'next/server'
import { getClientAndContext } from '../_helpers'

export async function POST(request: NextRequest) {
  try {
    const { supabase, ctx } = await getClientAndContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()

    // Versioning: when editing an existing plan, parent_plan_id points to the root of the
    // version chain. version = max existing version among root + all its direct children + 1.
    const parentPlanId: string | null = body.parent_plan_id ?? null
    let version = 1
    if (parentPlanId) {
      const { data: existing } = await supabase
        .from('nutrition_plans')
        .select('version')
        .or(`id.eq.${parentPlanId},parent_plan_id.eq.${parentPlanId}`)
        .eq('business_id', ctx.businessId)
      const versions = (existing ?? []).map((p: Record<string, unknown>) => (p.version as number) ?? 1)
      version = (versions.length > 0 ? Math.max(...versions) : 0) + 1
    }

    const { data, error } = await supabase
      .from('nutrition_plans')
      .insert({
        business_id:     ctx.businessId,
        employee_id:     ctx.employeeId ?? null,
        created_by:      ctx.employeeId ?? null,
        client_name:     body.client_name,
        client_phone:    body.client_phone    ?? null,
        client_email:    body.client_email    ?? null,
        client_document: body.client_document ?? null,
        client_id:       body.client_id       ?? null,
        parent_plan_id:  parentPlanId,
        version,
        duration_days:   body.duration_days,
        notes:           body.notes           ?? null,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Save clinical patient info if provided
    if (body.patientInfo && data?.id) {
      const pi = body.patientInfo
      const { error: piErr } = await supabase.from('patient_info').insert({
        plan_id:             data.id,
        age:                 pi.age                ?? null,
        weight_kg:           pi.weight_kg           ?? null,
        height_cm:           pi.height_cm           ?? null,
        nutritional_status:  pi.nutritional_status  ?? null,
        objective:           pi.objective           ?? null,
        restrictions:        pi.restrictions        ?? null,
        allergies:           pi.allergies           ?? null,
        medical_conditions:  pi.medical_conditions  ?? null,
        activity_level:      pi.activity_level      ?? null,
      })
      if (piErr) console.error('patient_info insert:', piErr.message)
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    console.error('POST /api/nutrition/plans:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const { supabase, ctx } = await getClientAndContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let query = supabase
      .from('nutrition_plans')
      .select('*, patient_info(*)')
      .order('created_at', { ascending: false })

    if (ctx.role === 'employee') {
      // Employee sees only the plans they created
      query = query.eq('created_by', ctx.employeeId!)
    } else {
      // Owner sees every plan for the business
      query = query.eq('business_id', ctx.businessId)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Flatten patient_info from array (PostgREST one-to-many) to single object
    const plans = (data ?? []).map((p: Record<string, unknown>) => {
      const pi = p.patient_info
      return { ...p, patient_info: Array.isArray(pi) ? (pi[0] ?? null) : (pi ?? null) }
    })
    return NextResponse.json(plans)
  } catch (error) {
    console.error('GET /api/nutrition/plans:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { supabase, ctx } = await getClientAndContext()
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const planId = request.nextUrl.searchParams.get('id')
    if (!planId) return NextResponse.json({ error: 'id required' }, { status: 400 })

    let query = supabase
      .from('nutrition_plans')
      .delete()
      .eq('id', planId)
      .eq('business_id', ctx.businessId)

    // Employee can only delete their own plans
    if (ctx.role === 'employee') {
      query = query.eq('created_by', ctx.employeeId!)
    }

    const { error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/nutrition/plans:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
