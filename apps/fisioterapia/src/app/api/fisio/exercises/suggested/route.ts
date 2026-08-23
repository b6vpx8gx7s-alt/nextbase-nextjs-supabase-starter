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
      .select('id, nombre, grupo_muscular, gif_url, business_id, businesses(name)')
      .eq('suggested_for_public', true)
      .eq('visibility', 'private')
      .order('nombre');

    if (error) throw new Error(error.message);

    const exercises = (data ?? []).map((ex) => ({
      id: ex.id,
      nombre: ex.nombre,
      grupo_muscular: ex.grupo_muscular,
      gif_url: ex.gif_url ?? null,
      business_name: (ex.businesses as unknown as { name: string } | null)?.name ?? null,
    }));

    return NextResponse.json({ exercises });
  } catch (err) {
    console.error('[GET /api/fisio/exercises/suggested]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
