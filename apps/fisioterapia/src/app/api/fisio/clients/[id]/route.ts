import { NextResponse } from 'next/server';
import { getClientAndContext } from '../../_helpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, ctx } = await getClientAndContext();
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const [clientRes, pathRes, painRes, routineRes] = await Promise.all([
    supabase
      .from('physio_clients')
      .select('*')
      .eq('id', id)
      .eq('business_id', ctx.businessId)
      .maybeSingle(),
    supabase
      .from('pathologies')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: true }),
    supabase
      .from('pain_map')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('physio_routines')
      .select('id, semana, year, routine_data, estado, generated_at')
      .eq('client_id', id)
      .eq('business_id', ctx.businessId)
      .order('generated_at', { ascending: false })
      .limit(10),
  ]);

  if (!clientRes.data) {
    return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    client: clientRes.data,
    pathologies: pathRes.data ?? [],
    pain_map: painRes.data ?? [],
    routines: routineRes.data ?? [],
  });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, ctx } = await getClientAndContext();
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const body = await request.json();
  const allowed = ['nombre', 'email', 'telefono', 'fecha_nacimiento', 'nivel_fisico', 'objetivo', 'dias_disponibles', 'notas'];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }
  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('physio_clients')
    .update(updates)
    .eq('id', id)
    .eq('business_id', ctx.businessId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const { supabase, ctx } = await getClientAndContext();
  if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

  const { error } = await supabase
    .from('physio_clients')
    .delete()
    .eq('id', id)
    .eq('business_id', ctx.businessId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
