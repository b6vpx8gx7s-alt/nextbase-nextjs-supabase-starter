import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../_helpers';

export async function GET() {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const admin = createFisioAdminClient();

    // ── DEBUG: show what business_ids exist vs what we're querying ──
    const { data: allRows } = await admin
      .from('physio_clients')
      .select('id, business_id')
      .limit(10);
    console.log('[GET /api/fisio/clients] ctx.businessId =', ctx.businessId);
    console.log('[GET /api/fisio/clients] physio_clients sample (id, business_id):', JSON.stringify(allRows));
    // ── END DEBUG ──

    const { data, error } = await admin
      .from('physio_clients')
      .select('*')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/fisio/clients] query error:', error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ clients: data });
  } catch (err) {
    console.error('[GET /api/fisio/clients] exception:', err);
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
      roda_customer_id = null,
    } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // ── Crear cliente ─────────────────────────────────────────
    const { data: client, error: clientError } = await supabase
      .from('physio_clients')
      .insert({
        business_id: ctx.businessId,
        roda_customer_id: roda_customer_id || null,
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

    // ── Vincular paciente al portal (si tiene email) ──────────────
    if (email?.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      try {
        // Check if an auth user already exists with this email
        const { data: existingAuthId } = await supabase.rpc('get_auth_user_id_by_email', {
          p_email: normalizedEmail,
        });

        let authUserId: string | null = existingAuthId ?? null;

        if (!authUserId) {
          // New user — send invite email
          const baseUrl =
            process.env.NODE_ENV === 'production'
              ? 'https://fisioterapia.roda.ink'
              : 'http://localhost:3001';
          const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
            normalizedEmail,
            { redirectTo: `${baseUrl}/portal/complete-invite` }
          );
          if (inviteError) {
            console.error('[POST /api/fisio/clients] inviteUserByEmail error:', inviteError.message);
          } else {
            authUserId = invited.user.id;
          }
        }

        if (authUserId) {
          const { error: linkError } = await supabase
            .from('physio_client_users')
            .insert({ physio_client_id: client.id, auth_user_id: authUserId });
          if (linkError) {
            console.error('[POST /api/fisio/clients] Insert physio_client_users error:', linkError.message, linkError.code);
          }
        }
      } catch (err) {
        // Non-fatal: patient is created, portal link will need manual fix
        console.error('[POST /api/fisio/clients] Portal link exception:', err);
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
