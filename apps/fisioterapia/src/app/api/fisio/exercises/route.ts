import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../_helpers';
import { getAllExercisesWithFlags } from '@/lib/rutina/safety';

export async function GET(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const supabase = createFisioAdminClient();

    const clientId = new URL(request.url).searchParams.get('client_id');
    if (!clientId) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 });

    const { data: client } = await supabase
      .from('physio_clients')
      .select('id')
      .eq('id', clientId)
      .eq('business_id', ctx.businessId)
      .maybeSingle();

    if (!client) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });

    const exercises = await getAllExercisesWithFlags(clientId, supabase);
    return NextResponse.json({ exercises });
  } catch (err) {
    console.error('[GET /api/fisio/exercises]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
