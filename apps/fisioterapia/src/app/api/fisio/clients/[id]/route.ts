import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../../_helpers';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const supabase = createFisioAdminClient();

    const [clientRes, pathRes, painRes, routineRes, gifRes] = await Promise.all([
      supabase
        .from('physio_clients')
        .select('*')
        .eq('id', id)
        .eq('business_id', ctx.businessId)
        .maybeSingle(),
      supabase
        .from('pathologies')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('pain_map')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('physio_routines')
        .select('id, semana, year, routine_data, estado, generated_at')
        .eq('client_id', id)
        .eq('business_id', ctx.businessId)
        .order('generated_at', { ascending: false })
        .limit(10),
      supabase
        .from('exercises')
        .select('id, gif_url'),
    ]);

    // Surface any query errors so Vercel logs show them
    if (clientRes.error) {
      console.error('[GET /api/fisio/clients/[id]] physio_clients error:', clientRes.error.message, clientRes.error.code, clientRes.error.hint);
      return NextResponse.json({ error: clientRes.error.message }, { status: 500 });
    }
    if (!clientRes.data) {
      return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });
    }
    if (pathRes.error) {
      console.error('[GET /api/fisio/clients/[id]] pathologies error:', pathRes.error.message);
    }
    if (painRes.error) {
      console.error('[GET /api/fisio/clients/[id]] pain_map error:', painRes.error.message);
    }
    if (routineRes.error) {
      console.error('[GET /api/fisio/clients/[id]] physio_routines error:', routineRes.error.message);
    }

    // Build exercise_id → gif_url map for hydrating stored routine JSON
    const gifMap = new Map<string, string | null>(
      (gifRes.data ?? []).map((e: { id: string; gif_url: string | null }) => [e.id, e.gif_url])
    );

    // Hydrate gif_url on each DraftEjercicio by exercise_id.
    // Covers routines created before gif_url was added to the JSON schema.
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
      pathologies: pathRes.data ?? [],
      pain_map: painRes.data ?? [],
      routines,
    });
  } catch (err) {
    console.error('[GET /api/fisio/clients/[id]] Unhandled exception:', err);
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
    const supabase = createFisioAdminClient();

    const body = await request.json();
    const allowed = ['nombre', 'email', 'telefono', 'fecha_nacimiento', 'nivel_fisico', 'objetivo', 'dias_disponibles', 'notas'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in body) updates[key] = body[key];
    }
    updates.updated_at = new Date().toISOString();

    const { error } = await supabase
      .from('physio_clients')
      .update(updates)
      .eq('id', id)
      .eq('business_id', ctx.businessId);

    if (error) {
      console.error('[PATCH /api/fisio/clients/[id]] error:', error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/fisio/clients/[id]] Unhandled exception:', err);
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
    const supabase = createFisioAdminClient();

    const { error } = await supabase
      .from('physio_clients')
      .delete()
      .eq('id', id)
      .eq('business_id', ctx.businessId);

    if (error) {
      console.error('[DELETE /api/fisio/clients/[id]] error:', error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/fisio/clients/[id]] Unhandled exception:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
