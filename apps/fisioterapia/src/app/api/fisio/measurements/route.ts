import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../_helpers';

export async function GET(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    if (!clientId) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 });

    const supabase = createFisioAdminClient();

    // Latest measurement per type for this patient
    const { data, error } = await supabase.rpc('get_latest_measurements', {
      p_client_id: clientId,
      p_business_id: ctx.businessId,
    });

    if (error) {
      // Fallback if RPC doesn't exist yet: fetch all and dedupe in JS
      const { data: all, error: allErr } = await supabase
        .from('patient_measurements')
        .select(`
          id, measurement_type, value, unit, measured_at, notes, created_at,
          measurement_types ( label, category, unit_default, min_value, max_value )
        `)
        .eq('client_id', clientId)
        .eq('business_id', ctx.businessId)
        .order('measured_at', { ascending: false });

      if (allErr) throw new Error(allErr.message);

      // Keep only the most recent per type
      const seen = new Set<string>();
      const latest = (all ?? []).filter((row) => {
        if (seen.has(row.measurement_type)) return false;
        seen.add(row.measurement_type);
        return true;
      });

      return NextResponse.json({ measurements: latest });
    }

    return NextResponse.json({ measurements: data ?? [] });
  } catch (err) {
    console.error('[GET /api/fisio/measurements]', err);
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

    const body = (await request.json()) as {
      client_id: string;
      measurement_type: string;
      value: number;
      unit?: string;
      measured_at?: string;
      notes?: string;
    };

    const { client_id, measurement_type, value, unit, measured_at, notes } = body;

    if (!client_id || !measurement_type || value === undefined || value === null) {
      return NextResponse.json(
        { error: 'client_id, measurement_type y value son requeridos' },
        { status: 400 }
      );
    }

    const supabase = createFisioAdminClient();

    const { data, error } = await supabase
      .from('patient_measurements')
      .insert({
        business_id: ctx.businessId,
        client_id,
        measurement_type,
        value,
        unit: unit ?? null,
        measured_at: measured_at ?? new Date().toISOString().slice(0, 10),
        notes: notes ?? null,
      })
      .select(`
        id, measurement_type, value, unit, measured_at, notes, created_at,
        measurement_types ( label, category, unit_default, min_value, max_value )
      `)
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ measurement: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/fisio/measurements]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
