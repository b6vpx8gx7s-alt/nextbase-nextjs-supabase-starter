import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../../_helpers';
import { parseReps } from '@/lib/rutina/safety';
import type { DraftDia } from '@/lib/fisio-types';

type Params = { params: Promise<{ id: string }> };

function getISOWeek(date: Date): { semana: number; year: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const semana = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { semana, year: d.getFullYear() };
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { dias } = (await request.json()) as { dias: DraftDia[] };
    if (!Array.isArray(dias) || dias.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un día con ejercicios' }, { status: 400 });
    }

    const supabase = createFisioAdminClient();

    const { data: existing } = await supabase
      .from('physio_routines')
      .select('id, client_id')
      .eq('id', id)
      .eq('business_id', ctx.businessId)
      .maybeSingle();

    if (!existing) return NextResponse.json({ error: 'Rutina no encontrada' }, { status: 404 });

    const { semana, year } = getISOWeek(new Date());
    const now = new Date().toISOString();

    const { error: updateError } = await supabase
      .from('physio_routines')
      .update({ routine_data: { dias, notas_generales: null }, semana, year, generated_at: now })
      .eq('id', id);

    if (updateError) throw new Error(updateError.message);

    // Replace exercise detail rows
    await supabase.from('physio_routine_exercises').delete().eq('routine_id', id);

    const exerciseRows = dias.flatMap((dia) =>
      dia.ejercicios.map((ej, orden) => ({
        routine_id: id,
        exercise_id: ej.exercise_id,
        dia: Math.min(Math.max(dia.dia_index + 1, 1), 7),
        series: ej.series,
        reps_o_segundos: parseReps(ej.repeticiones),
        tempo: null,
        orden,
        notas_adaptacion: ej.nota ?? null,
      }))
    );

    if (exerciseRows.length > 0) {
      const { error: exError } = await supabase.from('physio_routine_exercises').insert(exerciseRows);
      if (exError) throw new Error(exError.message);
    }

    return NextResponse.json({
      routine: {
        id,
        client_id: existing.client_id,
        semana,
        year,
        routine_data: { dias, notas_generales: null },
        estado: 'generada' as const,
        generated_at: now,
      },
    });
  } catch (err) {
    console.error('[PATCH /api/fisio/routines/[id]]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
