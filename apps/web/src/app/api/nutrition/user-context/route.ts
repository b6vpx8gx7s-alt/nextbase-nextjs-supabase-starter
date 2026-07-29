import { NextResponse } from 'next/server'
import { getClientAndContext } from '../_helpers'

export async function GET() {
  const { ctx } = await getClientAndContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({
    role:       ctx.role,
    employeeId: ctx.employeeId,
    businessId: ctx.businessId,
  })
}
