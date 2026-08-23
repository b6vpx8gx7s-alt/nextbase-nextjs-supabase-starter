import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../../../_helpers';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const supabase = createGymAdminClient();

    const { data: exercise } = await supabase
      .from('exercises')
      .select('id, business_id')
      .eq('id', id)
      .maybeSingle();

    if (!exercise) return NextResponse.json({ error: 'Ejercicio no encontrado' }, { status: 404 });
    if (exercise.business_id !== ctx.businessId) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { error } = await supabase
      .from('exercises')
      .update({ suggested_for_public: true })
      .eq('id', id);

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/gym/exercises/[id]/suggest]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
