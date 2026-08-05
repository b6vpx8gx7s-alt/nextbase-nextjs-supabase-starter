import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../_helpers';

export async function GET() {
  console.log('[GET /api/fisio/clients] ── START ──');
  try {
    console.log('[GET /api/fisio/clients] Calling getClientAndContext...');
    const { supabase, ctx } = await getClientAndContext();
    console.log('[GET /api/fisio/clients] Auth user:', ctx?.userId ?? 'NULL');
    console.log('[GET /api/fisio/clients] Business ID:', ctx?.businessId ?? 'NULL');

    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    console.log('[GET /api/fisio/clients] Antes de query physio_clients');
    const { data, error } = await supabase
      .from('physio_clients')
      .select('*')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false });

    console.log('[GET /api/fisio/clients] Query result — error:', error?.message ?? 'none', '| rows:', data?.length ?? 'null');

    if (error) {
      console.error('[GET /api/fisio/clients] Supabase error:', error.message, error.code, error.hint);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ clients: data });
  } catch (err) {
    console.error('[GET /api/fisio/clients] Unhandled exception:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const supabase = createFisioAdminClient();

    const body = await request.json();
    const {
      nombre,
      email,
      telefono,
      fecha_nacimiento,
      nivel_fisico = 'principiante',
      objetivo = 'rehabilitacion',
      dias_disponibles = [],
      notas,
      pathologies = [],
      pain_entries = [],
    } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // ── Crear cliente ─────────────────────────────────────────
    const { data: client, error: clientError } = await supabase
      .from('physio_clients')
      .insert({
        business_id: ctx.businessId,
        nombre: nombre.trim(),
        email: email || null,
        telefono: telefono || null,
        fecha_nacimiento: fecha_nacimiento || null,
        nivel_fisico,
        objetivo,
        dias_disponibles,
        notas: notas || null,
      })
      .select('id')
      .single();

    if (clientError || !client) {
      console.error('[POST /api/fisio/clients] Insert physio_clients error:', clientError?.message, clientError?.code, clientError?.hint);
      return NextResponse.json(
        { error: clientError?.message ?? 'Error al crear paciente' },
        { status: 500 }
      );
    }

    // ── Insertar patologías ───────────────────────────────────
    if (pathologies.length > 0) {
      const pathRows = pathologies.map(
        (p: { nombre: string; zona_corporal: string; fecha_diagnostico?: string; notas?: string }) => ({
          business_id: ctx.businessId,
          client_id: client.id,
          nombre: p.nombre,
          zona_corporal: p.zona_corporal,
          fecha_diagnostico: p.fecha_diagnostico || null,
          notas: p.notas || null,
        })
      );
      const { error: pathError } = await supabase.from('pathologies').insert(pathRows);
      if (pathError) {
        console.error('[POST /api/fisio/clients] Insert pathologies error:', pathError.message, pathError.code);
      }
    }

    // ── Insertar mapa de dolor ────────────────────────────────
    if (pain_entries.length > 0) {
      const painRows = pain_entries.map(
        (p: { zona_corporal: string; mecanica: string; nivel: number }) => ({
          business_id: ctx.businessId,
          client_id: client.id,
          zona_corporal: p.zona_corporal,
          mecanica: p.mecanica,
          nivel: p.nivel,
        })
      );
      const { error: painError } = await supabase.from('pain_map').insert(painRows);
      if (painError) {
        console.error('[POST /api/fisio/clients] Insert pain_map error:', painError.message, painError.code);
      }
    }

    return NextResponse.json({ client: { id: client.id } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/fisio/clients] Unhandled exception:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
