import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/supabase-clients/server';
import { createGymAdminClient } from '../../_helpers';

// GET /api/gym/portal/sessions?routineId=X[&date=YYYY-MM-DD]
// Returns sessions for target date, all distinct past dates (for nav), and
// the most recent set log per exercise from any session before targetDate (for "Última vez").
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const routineId = searchParams.get('routineId');
    if (!routineId) return NextResponse.json({ error: 'routineId requerido' }, { status: 400 });

    const supabase = await createSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: link } = await supabase
      .from('gym_client_users')
      .select('gym_client_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: 'No es cliente de gym' }, { status: 403 });

    const admin = createGymAdminClient();
    const today = new Date().toISOString().split('T')[0];
    const targetDate = searchParams.get('date') ?? today;

    // Sessions + set_logs for the target date
    const { data: sessions, error } = await admin
      .from('gym_workout_sessions')
      .select('id, dia_index, trained_at, gym_set_logs(id, exercise_id, set_num, reps_o_seg, peso_kg, nota)')
      .eq('client_id', link.gym_client_id)
      .eq('routine_id', routineId)
      .eq('trained_at', targetDate);
    if (error) throw new Error(error.message);

    // All distinct dates with sessions for this routine, desc, for navigation
    const { data: dateSessions } = await admin
      .from('gym_workout_sessions')
      .select('trained_at')
      .eq('client_id', link.gym_client_id)
      .eq('routine_id', routineId)
      .order('trained_at', { ascending: false })
      .limit(60);
    const pastDates = [...new Set((dateSessions ?? []).map((s) => s.trained_at as string))];

    // Previous best per exercise: most recent set from any session BEFORE targetDate
    const { data: prevSessions } = await admin
      .from('gym_workout_sessions')
      .select('id, trained_at')
      .eq('client_id', link.gym_client_id)
      .lt('trained_at', targetDate)
      .order('trained_at', { ascending: false })
      .limit(100);

    const prevSessionIds = (prevSessions ?? []).map((s) => s.id as string);
    const sessionDateMap: Record<string, string> = {};
    for (const s of prevSessions ?? []) sessionDateMap[s.id] = s.trained_at;

    type PreviousBest = { reps_o_seg: number; peso_kg: number | null; trained_at: string };
    const previousBest: Record<string, PreviousBest> = {};

    if (prevSessionIds.length > 0) {
      const { data: prevLogs } = await admin
        .from('gym_set_logs')
        .select('exercise_id, reps_o_seg, peso_kg, set_num, session_id')
        .in('session_id', prevSessionIds);

      // Sort: trained_at desc, then set_num desc → first occurrence per exercise = most recent set
      const sorted = (prevLogs ?? []).sort((a, b) => {
        const dA = sessionDateMap[a.session_id] ?? '';
        const dB = sessionDateMap[b.session_id] ?? '';
        if (dB !== dA) return dB > dA ? 1 : -1;
        return b.set_num - a.set_num;
      });

      for (const log of sorted) {
        if (!previousBest[log.exercise_id]) {
          previousBest[log.exercise_id] = {
            reps_o_seg: log.reps_o_seg,
            peso_kg: log.peso_kg,
            trained_at: sessionDateMap[log.session_id] ?? '',
          };
        }
      }
    }

    return NextResponse.json({ sessions: sessions ?? [], pastDates, previousBest });
  } catch (err) {
    console.error('[GET /api/gym/portal/sessions]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

// POST /api/gym/portal/sessions
// Body: { routineId, diaIndex }
// Creates (or returns existing) session for today.
export async function POST(request: Request) {
  try {
    const { routineId, diaIndex } = (await request.json()) as {
      routineId: string;
      diaIndex: number;
    };
    if (!routineId || diaIndex === undefined) {
      return NextResponse.json({ error: 'routineId y diaIndex requeridos' }, { status: 400 });
    }

    const supabase = await createSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { data: link } = await supabase
      .from('gym_client_users')
      .select('gym_client_id')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: 'No es cliente de gym' }, { status: 403 });

    const admin = createGymAdminClient();
    const today = new Date().toISOString().split('T')[0];

    // Return existing session if already created today
    const { data: existing } = await admin
      .from('gym_workout_sessions')
      .select('id')
      .eq('client_id', link.gym_client_id)
      .eq('routine_id', routineId)
      .eq('dia_index', diaIndex)
      .eq('trained_at', today)
      .maybeSingle();

    if (existing) return NextResponse.json({ sessionId: existing.id });

    // Look up business_id from the routine (validates ownership too)
    const { data: routine } = await admin
      .from('gym_routines')
      .select('business_id')
      .eq('id', routineId)
      .eq('client_id', link.gym_client_id)
      .maybeSingle();
    if (!routine) return NextResponse.json({ error: 'Rutina no encontrada' }, { status: 404 });

    const { data: session, error } = await admin
      .from('gym_workout_sessions')
      .insert({
        business_id: routine.business_id,
        client_id: link.gym_client_id,
        routine_id: routineId,
        dia_index: diaIndex,
        trained_at: today,
      })
      .select('id')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ sessionId: session.id }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/gym/portal/sessions]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
