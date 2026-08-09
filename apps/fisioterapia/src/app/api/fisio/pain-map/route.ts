import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../_helpers';

export async function POST(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = (await request.json()) as {
      client_id: string;
      zona_corporal: string;
      mecanica: string;
      nivel: number;
    };

    const { client_id, zona_corporal, mecanica, nivel } = body;

    if (!client_id || !zona_corporal?.trim() || !mecanica?.trim()) {
      return NextResponse.json(
        { error: 'client_id, zona_corporal y mecanica son requeridos' },
        { status: 400 }
      );
    }
    if (!Number.isInteger(nivel) || nivel < 1 || nivel > 10) {
      return NextResponse.json({ error: 'nivel debe ser un entero entre 1 y 10' }, { status: 400 });
    }

    const supabase = createFisioAdminClient();

    const { data, error } = await supabase
      .from('pain_map')
      .insert({
        business_id: ctx.businessId,
        client_id,
        zona_corporal: zona_corporal.trim(),
        mecanica: mecanica.trim(),
        nivel,
      })
      .select('id, zona_corporal, mecanica, nivel, created_at')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ entry: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/fisio/pain-map]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
