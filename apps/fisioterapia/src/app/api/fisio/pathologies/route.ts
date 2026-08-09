import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../_helpers';

export async function POST(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = (await request.json()) as {
      client_id: string;
      nombre: string;
      zona_corporal: string;
      fecha_diagnostico?: string;
      notas?: string;
    };

    const { client_id, nombre, zona_corporal, fecha_diagnostico, notas } = body;

    if (!client_id || !nombre?.trim() || !zona_corporal?.trim()) {
      return NextResponse.json(
        { error: 'client_id, nombre y zona_corporal son requeridos' },
        { status: 400 }
      );
    }

    const supabase = createFisioAdminClient();

    const { data, error } = await supabase
      .from('pathologies')
      .insert({
        business_id: ctx.businessId,
        client_id,
        nombre: nombre.trim(),
        zona_corporal: zona_corporal.trim(),
        fecha_diagnostico: fecha_diagnostico || null,
        notas: notas?.trim() || null,
      })
      .select('id, nombre, zona_corporal, fecha_diagnostico, notas, created_at')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ pathology: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/fisio/pathologies]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
