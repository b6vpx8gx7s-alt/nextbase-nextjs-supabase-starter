import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../../_helpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const supabase = createGymAdminClient();

    const [clientRes, routineRes, gifRes] = await Promise.all([
      supabase
        .from('gym_clients')
        .select('*')
        .eq('id', id)
        .eq('business_id', ctx.businessId)
        .maybeSingle(),
      supabase
        .from('gym_routines')
        .select('id, semana, year, routine_data, estado, generated_at')
        .eq('client_id', id)
        .eq('business_id', ctx.businessId)
        .order('generated_at', { ascending: false })
        .limit(10),
      supabase
        .from('exercises')
        .select('id, gif_url'),
    ]);

    if (clientRes.error) {
      console.error('[GET /api/gym/clients/[id]] gym_clients error:', clientRes.error.message, clientRes.error.code, clientRes.error.hint);
      return NextResponse.json({ error: clientRes.error.message }, { status: 500 });
    }
    if (!clientRes.data) {
      return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });
    }
    if (routineRes.error) {
      console.error('[GET /api/gym/clients/[id]] gym_routines error:', routineRes.error.message);
    }

    const gifMap = new Map<string, string | null>(
      (gifRes.data ?? []).map((e: { id: string; gif_url: string | null }) => [e.id, e.gif_url])
    );

    const routines = (routineRes.data ?? []).map((r) => ({
      ...r,
      routine_data: r.routine_data
        ? {
            ...r.routine_data,
            dias: ((r.routine_data as { dias?: unknown[] }).dias ?? []).map((dia) => ({
              ...(dia as object),
              ejercicios: ((dia as { ejercicios?: { exercise_id?: string; gif_url?: string | null }[] }).ejercicios ?? []).map((ej) => ({
                ...ej,
                gif_url: ej.gif_url ?? gifMap.get(ej.exercise_id ?? '') ?? null,
              })),
            })),
          }
        : r.routine_data,
    }));

    return NextResponse.json({
      client: clientRes.data,
      routines,
    });
  } catch (err) {
    console.error('[GET /api/gym/clients/[id]] Unhandled exception:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const supabase = createGymAdminClient();

    const body = await request.json();
    const allowed = [
      'nombre', 'email', 'telefono', 'fecha_nacimiento', 'sexo',
      'nivel_entrenamiento', 'tiempo_entrenando', 'objetivo_principal',
      'dias_disponibles', 'horario_laboral', 'hora_despertar', 'hora_dormir',
      'hora_entrenar', 'deporte_alterno', 'usa_esteroides',
      'problema_cardiovascular', 'lesion_actual', 'zona_a_mejorar', 'notas',
    ];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('gym_clients')
      .update(updates)
      .eq('id', id)
      .eq('business_id', ctx.businessId);

    if (error) {
      console.error('[PATCH /api/gym/clients/[id]] error:', error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/gym/clients/[id]] Unhandled exception:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const supabase = createGymAdminClient();

    const { error } = await supabase
      .from('gym_clients')
      .delete()
      .eq('id', id)
      .eq('business_id', ctx.businessId);

    if (error) {
      console.error('[DELETE /api/gym/clients/[id]] error:', error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/gym/clients/[id]] Unhandled exception:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
