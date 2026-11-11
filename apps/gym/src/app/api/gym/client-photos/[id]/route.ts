import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../../_helpers';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { id } = await params;
    const admin = createGymAdminClient();

    const { data: photo, error: fetchErr } = await admin
      .from('gym_client_photos')
      .select('storage_path, business_id')
      .eq('id', id)
      .single();

    if (fetchErr || !photo) return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    if (photo.business_id !== ctx.businessId) return NextResponse.json({ error: 'Sin permiso' }, { status: 403 });

    await admin.storage.from('gym-client-photos').remove([photo.storage_path]);
    await admin.from('gym_client_photos').delete().eq('id', id);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
