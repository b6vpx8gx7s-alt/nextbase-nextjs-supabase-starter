import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../../_helpers';

function toCode(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
}

export async function POST(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = (await request.json()) as {
      label: string;
      unit?: string;
      category: string;
    };

    const { label, unit, category } = body;

    if (!label?.trim()) {
      return NextResponse.json({ error: 'El nombre es requerido' }, { status: 400 });
    }
    if (!['antropometrico', 'escala_clinica', 'rom', 'composicion_corporal'].includes(category)) {
      return NextResponse.json({ error: 'Categoría inválida' }, { status: 400 });
    }

    const code = toCode(label.trim());
    if (!code) {
      return NextResponse.json({ error: 'El nombre no genera un código válido' }, { status: 400 });
    }

    const supabase = createGymAdminClient();

    const { data: existing } = await supabase
      .from('measurement_types')
      .select('code')
      .eq('code', code)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Ya existe un tipo con ese nombre. Prueba con un nombre diferente.' },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('measurement_types')
      .insert({
        code,
        label: label.trim(),
        unit_default: unit?.trim() || null,
        category,
        applies_to: 'gym',
        min_value: null,
        max_value: null,
      })
      .select('code, label, unit_default, category, min_value, max_value')
      .single();

    if (error) throw new Error(error.message);

    return NextResponse.json({ type: data }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/gym/measurement-types/custom]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
