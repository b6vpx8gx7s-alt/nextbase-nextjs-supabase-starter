import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../../_helpers';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const supabase = createFisioAdminClient();

    const { data: existing } = await supabase
      .from('pain_map')
      .select('id')
      .eq('id', id)
      .eq('business_id', ctx.businessId)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Entrada no encontrada' }, { status: 404 });

    const { error } = await supabase.from('pain_map').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/fisio/pain-map/[id]]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
