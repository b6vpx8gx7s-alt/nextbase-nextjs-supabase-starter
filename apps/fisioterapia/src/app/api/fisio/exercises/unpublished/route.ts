import { NextResponse } from 'next/server';
import { createFisioClient, createFisioAdminClient, requireSuperAdmin } from '../../_helpers';

export async function GET() {
  try {
    const supabase = await createFisioClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (!(await requireSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const admin = createFisioAdminClient();
    const { data, error } = await admin
      .from('exercises')
      .select('id, nombre, grupo_muscular, gif_url')
      .is('business_id', null)
      .eq('visibility', 'private')
      .order('nombre');

    if (error) throw new Error(error.message);

    return NextResponse.json({ exercises: data ?? [] });
  } catch (err) {
    console.error('[GET /api/fisio/exercises/unpublished]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
