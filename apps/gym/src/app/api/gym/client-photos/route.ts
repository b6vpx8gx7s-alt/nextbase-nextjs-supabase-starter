import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../_helpers';
import { randomUUID } from 'crypto';

export async function GET(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const clientId = searchParams.get('client_id');
    if (!clientId) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 });

    const admin = createGymAdminClient();
    const { data, error } = await admin
      .from('gym_client_photos')
      .select('id, storage_path, photo_date, notes, created_at')
      .eq('client_id', clientId)
      .eq('business_id', ctx.businessId)
      .order('photo_date', { ascending: false });

    if (error) throw new Error(error.message);

    // Generate signed URLs (1 hour expiry)
    const photos = await Promise.all(
      (data ?? []).map(async (p) => {
        const { data: signed } = await admin.storage
          .from('gym-client-photos')
          .createSignedUrl(p.storage_path, 3600);
        return { ...p, photo_url: signed?.signedUrl ?? null };
      })
    );

    return NextResponse.json({ photos });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const clientId = formData.get('client_id') as string;
    const notes = (formData.get('notes') as string) || null;

    if (!file || !clientId) {
      return NextResponse.json({ error: 'file y client_id son requeridos' }, { status: 400 });
    }

    const admin = createGymAdminClient();
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${ctx.businessId}/${clientId}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await admin.storage
      .from('gym-client-photos')
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadErr) throw new Error(uploadErr.message);

    const { data: row, error: dbErr } = await admin
      .from('gym_client_photos')
      .insert({ business_id: ctx.businessId, client_id: clientId, storage_path: path, notes })
      .select()
      .single();

    if (dbErr) throw new Error(dbErr.message);

    const { data: signed } = await admin.storage
      .from('gym-client-photos')
      .createSignedUrl(path, 3600);

    return NextResponse.json({ photo: { ...row, photo_url: signed?.signedUrl ?? null } }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
