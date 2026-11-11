import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../_helpers';

export async function GET(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    if (!clientId) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 });

    const supabase = createGymAdminClient();

    // Return full history (all entries) ordered newest first — component groups and compares
    const { data, error } = await supabase
      .from('gym_measurements')
      .select(`
        id, measurement_type, value, unit, measured_at, notes, created_at,
        measurement_types ( label, category, unit_default, min_value, max_value )
      `)
      .eq('client_id', clientId)
      .eq('business_id', ctx.businessId)
      .order('measured_at', { ascending: false })
      .limit(200);

    if (error) throw new Error(error.message);

    return NextResponse.json({ measurements: data ?? [] });
  } catch (err) {
    console.error('[GET /api/gym/measurements]', err);
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

    const supabase = createGymAdminClient();

    const { data, error } = await supabase
      .from('gym_measurements')
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
    console.error('[POST /api/gym/measurements]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
