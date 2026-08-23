import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../../_helpers';

const VALID_GROUPS = ['pecho', 'hombros', 'espalda', 'piernas', 'gluteos', 'core', 'cardio', 'movilidad'];

export async function POST(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await request.json();
    const nombre = (body.nombre ?? '').trim();
    const grupo_muscular = (body.grupo_muscular ?? '').trim();
    const descripcion_breve = (body.descripcion_breve ?? '').trim() || null;
    const rawGifUrl = (body.gif_url ?? '').trim();

    if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });
    if (!VALID_GROUPS.includes(grupo_muscular)) {
      return NextResponse.json({ error: 'grupo_muscular inválido' }, { status: 400 });
    }

    let gif_url: string | null = null;
    if (rawGifUrl) {
      try {
        new URL(rawGifUrl);
        gif_url = rawGifUrl;
      } catch {
        return NextResponse.json({ error: 'gif_url debe ser una URL válida' }, { status: 400 });
      }
    }

    const supabase = createGymAdminClient();

    const { data: exercise, error } = await supabase
      .from('exercises')
      .insert({
        nombre,
        grupo_muscular,
        descripcion_breve,
        gif_url,
        patron: 'personalizado',
        nivel: 'intermedio',
        equipo: 'ninguno',
        business_id: ctx.businessId,
        visibility: 'private',
      })
      .select('id, nombre, patron, grupo_muscular, nivel, equipo, descripcion_breve, gif_url')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ exercise });
  } catch (err) {
    console.error('[POST /api/gym/exercises/custom]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
