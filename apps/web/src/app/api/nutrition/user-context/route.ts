import { NextResponse } from 'next/server'
import { getClientAndContext } from '../_helpers'

export async function GET() {
  const { supabase, ctx } = await getClientAndContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: biz } = await supabase
    .from('businesses')
    .select('name')
    .eq('id', ctx.businessId)
    .maybeSingle()

  return NextResponse.json({
    role:         ctx.role,
    employeeId:   ctx.employeeId,
    businessId:   ctx.businessId,
    businessName: biz?.name ?? null,
  })
}
