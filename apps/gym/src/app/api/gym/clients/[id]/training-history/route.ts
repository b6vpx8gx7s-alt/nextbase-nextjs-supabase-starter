import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../../../_helpers';
import type { DraftDia } from '@/lib/fisio-types';

type Params = { params: Promise<{ id: string }> };

interface SetLogRow {
  id: string;
  exercise_id: string;
  set_num: number;
  reps_o_seg: number;
  peso_kg: number | null;
  exercises: { nombre: string } | null;
}

interface SessionRow {
  id: string;
  dia_index: number;
  trained_at: string;
  routine_id: string;
  gym_set_logs: SetLogRow[];
  gym_routines: { routine_data: { dias: DraftDia[] } } | null;
}

export async function GET(_req: Request, { params }: Params) {
  try {
    const { id: clientId } = await params;
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const admin = createGymAdminClient();

    const { data: rawSessions, error } = await admin
      .from('gym_workout_sessions')
      .select(`
        id, dia_index, trained_at, routine_id,
        gym_routines(routine_data),
        gym_set_logs(
          id, exercise_id, set_num, reps_o_seg, peso_kg,
          exercises(nombre)
        )
      `)
      .eq('client_id', clientId)
      .eq('business_id', ctx.businessId)
      .order('trained_at', { ascending: false })
      .limit(60);

    if (error) throw new Error(error.message);

    const sessions = (rawSessions as unknown as SessionRow[] ?? []).map((s) => {
      const dias: DraftDia[] = s.gym_routines?.routine_data?.dias ?? [];
      const dia = dias.find((d) => d.dia_index === s.dia_index);
      return {
        id: s.id,
        dia_index: s.dia_index,
        dia_nombre: dia?.nombre ?? `Día ${s.dia_index + 1}`,
        trained_at: s.trained_at,
        set_logs: s.gym_set_logs.map((log) => ({
          id: log.id,
          exercise_id: log.exercise_id,
          exercise_name: log.exercises?.nombre ?? 'Ejercicio',
          set_num: log.set_num,
          reps_o_seg: log.reps_o_seg,
          peso_kg: log.peso_kg,
        })),
      };
    });

    return NextResponse.json({ sessions });
  } catch (err) {
    console.error('[GET /api/gym/clients/[id]/training-history]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
