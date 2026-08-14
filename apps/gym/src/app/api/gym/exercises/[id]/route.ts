import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../../_helpers';

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const body = await request.json();
    const rawGifUrl = (body.gif_url ?? '').trim();

    let gif_url: string | null = null;
    if (rawGifUrl) {
      try {
        new URL(rawGifUrl);
        gif_url = rawGifUrl;
      } catch {
        return NextResponse.json({ error: 'gif_url debe ser una URL válida' }, { status: 400 });
      }
    }

    const supabase = createGymAdminClient();
    const { error } = await supabase.from('exercises').update({ gif_url }).eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/gym/exercises/[id]]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
