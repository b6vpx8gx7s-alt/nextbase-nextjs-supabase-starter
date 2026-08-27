import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/supabase-clients/server';
import { createGymAdminClient } from '../../_helpers';

// POST /api/gym/portal/set-logs
// Body: { sessionId, exerciseId, setNum, repsOSeg, pesoKg?, nota? }
// Upserts a single set log. Safe to call multiple times (UNIQUE constraint).
export async function POST(request: Request) {
  try {
    const { sessionId, exerciseId, setNum, repsOSeg, pesoKg, nota } = (await request.json()) as {
      sessionId: string;
      exerciseId: string;
      setNum: number;
      repsOSeg: number;
      pesoKg?: number | null;
      nota?: string | null;
    };

    if (!sessionId || !exerciseId || !setNum || repsOSeg === undefined) {
      return NextResponse.json({ error: 'Campos requeridos faltantes' }, { status: 400 });
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

    // Verify the session belongs to this client before writing
    const { data: session } = await admin
      .from('gym_workout_sessions')
      .select('id')
      .eq('id', sessionId)
      .eq('client_id', link.gym_client_id)
      .maybeSingle();
    if (!session) return NextResponse.json({ error: 'Sesión no encontrada' }, { status: 404 });

    const { data, error } = await admin
      .from('gym_set_logs')
      .upsert(
        {
          session_id: sessionId,
          exercise_id: exerciseId,
          set_num: setNum,
          reps_o_seg: repsOSeg,
          peso_kg: pesoKg ?? null,
          nota: nota || null,
        },
        { onConflict: 'session_id,exercise_id,set_num' }
      )
      .select('id, reps_o_seg, peso_kg, nota')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ setLog: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/gym/portal/set-logs]', err);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
