import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioAdminClient } from '../../_helpers';

export async function POST(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const { filename, contentType } = (await request.json()) as {
      filename?: string;
      contentType?: string;
    };

    if (!contentType?.startsWith('image/') && contentType !== 'video/mp4') {
      return NextResponse.json({ error: 'Solo se aceptan imágenes o video MP4' }, { status: 400 });
    }

    // Sanitise extension — strip anything that isn't a lowercase letter or digit
    const rawExt = filename?.split('.').pop()?.toLowerCase() ?? 'jpg';
    const ext = rawExt.replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `exercises/${crypto.randomUUID()}.${ext}`;

    const supabase = createFisioAdminClient();

    const { data, error } = await supabase.storage
      .from('exercise-images')
      .createSignedUploadUrl(path);

    if (error || !data) throw new Error(error?.message ?? 'Error al generar URL de subida');

    const {
      data: { publicUrl },
    } = supabase.storage.from('exercise-images').getPublicUrl(path);

    return NextResponse.json({ signedUrl: data.signedUrl, path, publicUrl });
  } catch (err) {
    console.error('[POST /api/fisio/exercises/upload-url]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
