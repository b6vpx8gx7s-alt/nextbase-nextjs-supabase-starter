import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../../_helpers';
import { parseReps } from '@/lib/rutina/safety';
import type { DraftDia } from '@/lib/fisio-types';

export async function POST(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const supabase = createFisioAdminClient();

    const { client_id, dias } = (await request.json()) as {
      client_id: string;
      dias: DraftDia[];
    };

    if (!client_id) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 });
    if (!Array.isArray(dias) || dias.length === 0) {
      return NextResponse.json({ error: 'Se requiere al menos un día con ejercicios' }, { status: 400 });
    }

    const { data: client } = await supabase
      .from('physio_clients')
      .select('id')
      .eq('id', client_id)
      .eq('business_id', ctx.businessId)
      .maybeSingle();

    if (!client) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });

    const { semana, year } = getISOWeek(new Date());
    const now = new Date().toISOString();

    const { data: routine, error: routineError } = await supabase
      .from('physio_routines')
      .insert({
        business_id: ctx.businessId,
        client_id,
        semana,
        year,
        routine_data: { dias, notas_generales: null },
        estado: 'generada',
        generated_at: now,
      })
      .select('id')
      .single();

    if (routineError || !routine) throw new Error(routineError?.message ?? 'Error al crear rutina');

    const exerciseRows = dias.flatMap((dia) =>
      dia.ejercicios.map((ej, orden) => ({
        routine_id: routine.id,
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
        id: routine.id,
        client_id,
        semana,
        year,
        routine_data: { dias, notas_generales: null },
        estado: 'generada' as const,
        generated_at: now,
      },
    });
  } catch (err) {
    console.error('[POST /api/fisio/routines/manual]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}

function getISOWeek(date: Date): { semana: number; year: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const semana = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { semana, year: d.getFullYear() };
}
