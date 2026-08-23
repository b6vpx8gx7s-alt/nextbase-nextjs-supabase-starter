import { NextResponse } from 'next/server';
import { createFisioClient, createFisioAdminClient, requireSuperAdmin } from '../../../_helpers';

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createFisioClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (!(await requireSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { id } = await params;
    const admin = createFisioAdminClient();

    const { error } = await admin
      .from('exercises')
      .update({ visibility: 'public' })
      .eq('id', id)
      .is('business_id', null)
      .eq('visibility', 'private');

    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/fisio/exercises/[id]/republish]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
