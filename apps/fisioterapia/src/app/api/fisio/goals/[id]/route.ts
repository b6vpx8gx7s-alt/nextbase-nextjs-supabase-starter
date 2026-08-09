import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../../_helpers';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { estado } = (await request.json()) as { estado: string };
    if (!['activo', 'completado', 'pausado'].includes(estado)) {
      return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
    }

    const supabase = createFisioAdminClient();

    const { data: existing } = await supabase
      .from('patient_goals')
      .select('id')
      .eq('id', id)
      .eq('business_id', ctx.businessId)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Objetivo no encontrado' }, { status: 404 });

    const { data, error } = await supabase
      .from('patient_goals')
      .update({ estado })
      .eq('id', id)
      .select('id, descripcion, fecha_objetivo, estado, created_at')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ goal: data });
  } catch (err) {
    console.error('[PATCH /api/fisio/goals/[id]]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
