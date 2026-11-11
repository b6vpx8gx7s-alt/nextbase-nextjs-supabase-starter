import { NextResponse } from 'next/server';
import { getClientAndContext, createGymAdminClient } from '../_helpers';
import { randomUUID } from 'crypto';

export async function GET() {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const admin = createGymAdminClient();
    const { data, error } = await admin
      .from('gym_reference_photos')
      .select('id, gender, photo_url, caption, display_order, storage_path')
      .eq('business_id', ctx.businessId)
      .order('gender')
      .order('display_order');

    if (error) throw new Error(error.message);
    return NextResponse.json({ photos: data ?? [] });
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
    const gender = formData.get('gender') as string;
    const caption = (formData.get('caption') as string) || null;

    if (!file || !gender) {
      return NextResponse.json({ error: 'file y gender son requeridos' }, { status: 400 });
    }
    if (!['masculino', 'femenino'].includes(gender)) {
      return NextResponse.json({ error: 'gender debe ser masculino o femenino' }, { status: 400 });
    }

    const admin = createGymAdminClient();
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const path = `${ctx.businessId}/${gender}/${randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadErr } = await admin.storage
      .from('gym-reference-photos')
      .upload(path, buffer, { contentType: file.type, upsert: false });

    if (uploadErr) throw new Error(uploadErr.message);

    const { data: urlData } = admin.storage.from('gym-reference-photos').getPublicUrl(path);

    const { data: existing } = await admin
      .from('gym_reference_photos')
      .select('display_order')
      .eq('business_id', ctx.businessId)
      .eq('gender', gender)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: row, error: dbErr } = await admin
      .from('gym_reference_photos')
      .insert({
        business_id: ctx.businessId,
        gender,
        storage_path: path,
        photo_url: urlData.publicUrl,
        caption,
        display_order: (existing?.display_order ?? -1) + 1,
      })
      .select()
      .single();

    if (dbErr) throw new Error(dbErr.message);
    return NextResponse.json({ photo: row }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Error' }, { status: 500 });
  }
}
