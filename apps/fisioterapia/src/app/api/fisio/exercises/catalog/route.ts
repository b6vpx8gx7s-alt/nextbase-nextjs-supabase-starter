import { NextResponse } from 'next/server';
import { createFisioClient, createFisioAdminClient, requireSuperAdmin } from '../../_helpers';

export async function GET(request: Request) {
  try {
    const supabase = await createFisioClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (!(await requireSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const search = new URL(request.url).searchParams.get('search')?.trim() ?? '';

    const admin = createFisioAdminClient();
    let query = admin
      .from('exercises')
      .select('id, nombre, grupo_muscular, descripcion_breve, gif_url')
      .eq('visibility', 'public')
      .order('grupo_muscular')
      .order('nombre');

    if (search.length >= 2) {
      query = query.ilike('nombre', `%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return NextResponse.json({ exercises: data ?? [] });
  } catch (err) {
    console.error('[GET /api/fisio/exercises/catalog]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
