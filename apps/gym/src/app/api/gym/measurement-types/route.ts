import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../_helpers';

export async function GET() {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const supabase = createGymAdminClient();
    const { data, error } = await supabase
      .from('measurement_types')
      .select('code, label, unit_default, category, min_value, max_value')
      .in('applies_to', ['gym', 'ambos'])
      .order('category')
      .order('label');

    if (error) throw new Error(error.message);

    return NextResponse.json({ types: data ?? [] });
  } catch (err) {
    console.error('[GET /api/gym/measurement-types]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
