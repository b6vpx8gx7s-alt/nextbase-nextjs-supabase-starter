import { NextRequest, NextResponse } from 'next/server';
import { createFisioClient, createFisioAdminClient, requireSuperAdmin } from '@/app/api/fisio/_helpers';

export async function GET() {
  const supabase = await createFisioClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireSuperAdmin(user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const admin = createFisioAdminClient();
  const { data, error } = await admin
    .from('fisio_context_suggestions')
    .select('*')
    .eq('status', 'pending')
    .order('exercise_nombre');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ suggestions: data });
}

export async function PATCH(request: NextRequest) {
  const supabase = await createFisioClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await requireSuperAdmin(user.id))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { suggestionIds, action } = await request.json() as {
    suggestionIds: string[];
    action: 'accept' | 'reject';
  };

  if (!suggestionIds?.length || !['accept', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Missing suggestionIds or invalid action' }, { status: 400 });
  }

  const admin = createFisioAdminClient();

  const { data: suggestions, error: fetchError } = await admin
    .from('fisio_context_suggestions')
    .select('exercise_id')
    .in('id', suggestionIds);

  if (fetchError || !suggestions) {
    return NextResponse.json({ error: 'Sugerencias no encontradas' }, { status: 404 });
  }

  if (action === 'accept') {
    const exerciseIds = suggestions.map((s) => s.exercise_id as string);

    const { error: updateExercisesError } = await admin
      .from('exercises')
      .update({ context: 'ambos' })
      .in('id', exerciseIds);

    if (updateExercisesError) {
      return NextResponse.json(
        { error: `Error actualizando contexto de ejercicios: ${updateExercisesError.message}` },
        { status: 500 }
      );
    }
  }

  const { error: updateError } = await admin
    .from('fisio_context_suggestions')
    .update({
      status: action === 'accept' ? 'approved' : 'rejected',
      resolved_at: new Date().toISOString(),
    })
    .in('id', suggestionIds);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, count: suggestionIds.length });
}
