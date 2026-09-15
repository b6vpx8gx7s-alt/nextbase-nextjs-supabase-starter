import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../../_helpers';
import { parseReps } from '@/lib/rutina/safety';

export async function GET(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const routineId = searchParams.get('routineId');
    if (!routineId) return NextResponse.json({ error: 'routineId requerido' }, { status: 400 });

    const supabase = createGymAdminClient();

    const { data, error } = await supabase
      .from('gym_routine_pending_changes')
      .select('id, dia_index, old_exercise_id, old_exercise_nombre, new_exercise_id, new_exercise_nombre, new_gif_url, motivo, created_at')
      .eq('routine_id', routineId)
      .eq('business_id', ctx.businessId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { pendingChangeId, action } = (await request.json()) as {
      pendingChangeId: string;
      action: 'accept' | 'reject';
    };

    if (!pendingChangeId || !action) {
      return NextResponse.json({ error: 'pendingChangeId y action son requeridos' }, { status: 400 });
    }

    const supabase = createGymAdminClient();

    const { data: change, error: fetchError } = await supabase
      .from('gym_routine_pending_changes')
      .select('*')
      .eq('id', pendingChangeId)
      .eq('business_id', ctx.businessId)
      .eq('status', 'pending')
      .maybeSingle();

    if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 });
    if (!change) return NextResponse.json({ error: 'Cambio pendiente no encontrado' }, { status: 404 });

    if (action === 'reject') {
      await supabase
        .from('gym_routine_pending_changes')
        .update({ status: 'rejected', resolved_at: new Date().toISOString() })
        .eq('id', pendingChangeId);
      return NextResponse.json({ ok: true });
    }

    // action === 'accept': apply the change to routine_data and gym_routine_exercises
    const { data: routine, error: routineError } = await supabase
      .from('gym_routines')
      .select('id, routine_data')
      .eq('id', change.routine_id as string)
      .maybeSingle();

    if (routineError || !routine) {
      return NextResponse.json({ error: 'Rutina no encontrada' }, { status: 404 });
    }

    const routineData = routine.routine_data as {
      dias: Array<{ nombre: string; dia_index: number; ejercicios: Array<Record<string, unknown>> }>;
      notas_generales: string | null;
    };

    let foundDiaIndex = -1;
    let foundEjercicioIndex = -1;

    for (let d = 0; d < routineData.dias.length; d++) {
      if (routineData.dias[d].dia_index !== (change.dia_index as number)) continue;
      const idx = routineData.dias[d].ejercicios.findIndex(
        (e) => (e.exercise_id as string) === (change.old_exercise_id as string)
      );
      if (idx !== -1) {
        foundDiaIndex = d;
        foundEjercicioIndex = idx;
        break;
      }
    }

    if (foundDiaIndex === -1) {
      return NextResponse.json(
        { error: 'El ejercicio original ya no está en la rutina (puede haber sido modificado)' },
        { status: 409 }
      );
    }

    const updatedDias = routineData.dias.map((dia, dIdx) => {
      if (dIdx !== foundDiaIndex) return dia;
      return {
        ...dia,
        ejercicios: dia.ejercicios.map((ej, eIdx) => {
          if (eIdx !== foundEjercicioIndex) return ej;
          return {
            exercise_id: change.new_exercise_id as string,
            nombre: change.new_exercise_nombre as string,
            series: ej.series,
            repeticiones: ej.repeticiones,
            descanso_seg: ej.descanso_seg,
            gif_url: (change.new_gif_url as string | null) ?? null,
            peso_objetivo_kg: null,
            nota: null,
          };
        }),
      };
    });

    const { error: updateError } = await supabase
      .from('gym_routines')
      .update({ routine_data: { dias: updatedDias, notas_generales: routineData.notas_generales } })
      .eq('id', routine.id as string);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await supabase.from('gym_routine_exercises').delete().eq('routine_id', routine.id as string);

    const flatExercises = updatedDias.flatMap((dia) =>
      dia.ejercicios.map((ej, orden) => ({
        routine_id: routine.id as string,
        exercise_id: ej.exercise_id as string,
        dia: Math.min(Math.max((dia.dia_index as number) + 1, 1), 7),
        series: ej.series as number,
        reps_o_segundos: parseReps(ej.repeticiones as string),
        tempo: null,
        orden,
        notas_adaptacion: (ej.nota as string | null) ?? null,
      }))
    );

    const { error: insertFlatError } = await supabase.from('gym_routine_exercises').insert(flatExercises);
    if (insertFlatError) {
      return NextResponse.json(
        { error: `Cambio aplicado en routine_data pero falló tabla plana: ${insertFlatError.message}` },
        { status: 500 }
      );
    }

    await supabase
      .from('gym_routine_pending_changes')
      .update({ status: 'accepted', resolved_at: new Date().toISOString() })
      .eq('id', pendingChangeId);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
