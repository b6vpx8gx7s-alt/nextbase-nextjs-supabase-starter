import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../../_helpers';

const VALID_GROUPS = ['pecho', 'hombros', 'espalda', 'piernas', 'gluteos', 'core', 'cardio', 'movilidad'];

export async function POST(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await request.json();
    const nombre = (body.nombre ?? '').trim();
    const grupo_muscular = (body.grupo_muscular ?? '').trim();
    const descripcion_breve = (body.descripcion_breve ?? '').trim() || null;

    if (!nombre) return NextResponse.json({ error: 'nombre requerido' }, { status: 400 });
    if (!VALID_GROUPS.includes(grupo_muscular)) {
      return NextResponse.json({ error: 'grupo_muscular inválido' }, { status: 400 });
    }

    const supabase = createFisioAdminClient();

    const { data: exercise, error } = await supabase
      .from('exercises')
      .insert({
        nombre,
        grupo_muscular,
        descripcion_breve,
        patron: 'personalizado',
        nivel: 'intermedio',
        equipo: 'ninguno',
      })
      .select('id, nombre, patron, grupo_muscular, nivel, equipo, descripcion_breve')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ exercise });
  } catch (err) {
    console.error('[POST /api/fisio/exercises/custom]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
