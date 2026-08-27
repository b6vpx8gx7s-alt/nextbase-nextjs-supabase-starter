import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../_helpers';

export async function GET(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim() ?? '';

    if (search.length < 2) {
      return NextResponse.json({ customers: [] });
    }

    const admin = createGymAdminClient();
    const term = `%${search}%`;

    const { data, error } = await admin
      .from('customers')
      .select('id, name, phone, email')
      .eq('business_id', ctx.businessId)
      .or(`name.ilike.${term},phone.ilike.${term},email.ilike.${term}`)
      .limit(10);

    if (error) {
      console.error('[GET /api/gym/roda-customers] query error:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const customers = (data ?? []).map((c) => ({
      id: c.id,
      nombre: c.name,
      telefono: c.phone,
      email: c.email ?? null,
    }));

    return NextResponse.json({ customers });
  } catch (err) {
    console.error('[GET /api/gym/roda-customers] exception:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
