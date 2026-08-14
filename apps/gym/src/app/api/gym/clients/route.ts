import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../_helpers';

export async function GET() {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const admin = createGymAdminClient();

    const { data, error } = await admin
      .from('gym_clients')
      .select('*')
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[GET /api/gym/clients] query error:', error.message, error.code);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ clients: data });
  } catch (err) {
    console.error('[GET /api/gym/clients] exception:', err);
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
    const supabase = createGymAdminClient();

    const body = await request.json();
    const {
      nombre,
      email,
      telefono,
      fecha_nacimiento,
      sexo,
      nivel_entrenamiento = 'novato',
      tiempo_entrenando,
      objetivo_principal,
      dias_disponibles = [],
      horario_laboral,
      hora_despertar,
      hora_dormir,
      hora_entrenar,
      deporte_alterno,
      usa_esteroides = false,
      problema_cardiovascular,
      lesion_actual,
      zona_a_mejorar,
      notas,
      roda_customer_id = null,
    } = body;

    if (!nombre?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }

    // ── Crear cliente ─────────────────────────────────────────
    const { data: client, error: clientError } = await supabase
      .from('gym_clients')
      .insert({
        business_id: ctx.businessId,
        roda_customer_id: roda_customer_id || null,
        nombre: nombre.trim(),
        email: email || null,
        telefono: telefono || null,
        fecha_nacimiento: fecha_nacimiento || null,
        sexo: sexo || null,
        nivel_entrenamiento,
        tiempo_entrenando: tiempo_entrenando || null,
        objetivo_principal: objetivo_principal || null,
        dias_disponibles,
        horario_laboral: horario_laboral || null,
        hora_despertar: hora_despertar || null,
        hora_dormir: hora_dormir || null,
        hora_entrenar: hora_entrenar || null,
        deporte_alterno: deporte_alterno || null,
        usa_esteroides,
        problema_cardiovascular: problema_cardiovascular || null,
        lesion_actual: lesion_actual || null,
        zona_a_mejorar: zona_a_mejorar || null,
        notas: notas || null,
      })
      .select('id')
      .single();

    if (clientError || !client) {
      console.error('[POST /api/gym/clients] Insert gym_clients error:', clientError?.message, clientError?.code, clientError?.hint);
      return NextResponse.json(
        { error: clientError?.message ?? 'Error al crear cliente' },
        { status: 500 }
      );
    }

    // ── Vincular cliente al portal (si tiene email) ───────────
    if (email?.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      try {
        const { data: existingAuthId } = await supabase.rpc('get_auth_user_id_by_email', {
          p_email: normalizedEmail,
        });

        let authUserId: string | null = existingAuthId ?? null;

        if (!authUserId) {
          const baseUrl =
            process.env.NODE_ENV === 'production'
              ? 'https://gym.roda.ink'
              : 'http://localhost:3002';
          const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
            normalizedEmail,
            { redirectTo: `${baseUrl}/portal/complete-invite` }
          );
          if (inviteError) {
            console.error('[POST /api/gym/clients] inviteUserByEmail error:', inviteError.message);
          } else {
            authUserId = invited.user.id;
          }
        }

        if (authUserId) {
          const { error: linkError } = await supabase
            .from('gym_client_users')
            .insert({ gym_client_id: client.id, auth_user_id: authUserId });
          if (linkError) {
            console.error('[POST /api/gym/clients] Insert gym_client_users error:', linkError.message, linkError.code);
          }
        }
      } catch (err) {
        console.error('[POST /api/gym/clients] Portal link exception:', err);
      }
    }

    return NextResponse.json({ client: { id: client.id } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/gym/clients] Unhandled exception:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
