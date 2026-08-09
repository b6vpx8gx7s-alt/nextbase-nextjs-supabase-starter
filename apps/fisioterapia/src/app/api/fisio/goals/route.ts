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
    const { data, error } = await supabase
      .from('patient_goals')
      .select('id, descripcion, fecha_objetivo, estado, created_at')
      .eq('client_id', clientId)
      .eq('business_id', ctx.businessId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    return NextResponse.json({ goals: data ?? [] });
  } catch (err) {
    console.error('[GET /api/fisio/goals]', err);
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
      descripcion: string;
      fecha_objetivo?: string;
    };

    const { client_id, descripcion, fecha_objetivo } = body;

    if (!client_id || !descripcion?.trim()) {
      return NextResponse.json(
        { error: 'client_id y descripcion son requeridos' },
        { status: 400 }
      );
    }

    const supabase = createFisioAdminClient();
    const { data, error } = await supabase
      .from('patient_goals')
      .insert({
        business_id: ctx.businessId,
        client_id,
        descripcion: descripcion.trim(),
        fecha_objetivo: fecha_objetivo ?? null,
      })
      .select('id, descripcion, fecha_objetivo, estado, created_at')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ goal: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/fisio/goals]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
