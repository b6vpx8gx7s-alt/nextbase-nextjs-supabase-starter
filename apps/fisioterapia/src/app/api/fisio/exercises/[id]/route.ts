import { NextResponse } from 'next/server';
import { getClientAndContext, createFisioClient, createFisioAdminClient, requireSuperAdmin } from '../../_helpers';

const VALID_GROUPS = ['pecho', 'hombros', 'espalda', 'piernas', 'gluteos', 'core', 'cardio', 'movilidad'];

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const supabase = await createFisioClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const isSuperAdmin = await requireSuperAdmin(user.id);

    // Super admin: can update any public field on any exercise
    if (isSuperAdmin) {
      const patch: Record<string, unknown> = {};

      if (body.nombre !== undefined) {
        const nombre = String(body.nombre).trim();
        if (!nombre) return NextResponse.json({ error: 'nombre no puede estar vacío' }, { status: 400 });
        patch.nombre = nombre;
      }
      if (body.grupo_muscular !== undefined) {
        if (!VALID_GROUPS.includes(body.grupo_muscular)) {
          return NextResponse.json({ error: 'grupo_muscular inválido' }, { status: 400 });
        }
        patch.grupo_muscular = body.grupo_muscular;
      }
      if (body.descripcion_breve !== undefined) {
        patch.descripcion_breve = String(body.descripcion_breve).trim() || null;
      }
      if (body.gif_url !== undefined) {
        const raw = String(body.gif_url).trim();
        if (raw) {
          try { new URL(raw); } catch {
            return NextResponse.json({ error: 'gif_url debe ser una URL válida' }, { status: 400 });
          }
          patch.gif_url = raw;
        } else {
          patch.gif_url = null;
        }
      }

      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: 'Sin campos a actualizar' }, { status: 400 });
      }

      const admin = createFisioAdminClient();
      const { error } = await admin.from('exercises').update(patch).eq('id', id);
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true });
    }

    // Regular fisio user: gif_url only (ManualRoutineBuilder "replace gif" feature)
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

    const rawGifUrl = String(body.gif_url ?? '').trim();
    let gif_url: string | null = null;
    if (rawGifUrl) {
      try { new URL(rawGifUrl); } catch {
        return NextResponse.json({ error: 'gif_url debe ser una URL válida' }, { status: 400 });
      }
      gif_url = rawGifUrl;
    }

    const admin = createFisioAdminClient();
    const { error } = await admin.from('exercises').update({ gif_url }).eq('id', id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/fisio/exercises/[id]]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;

    const supabase = await createFisioClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    if (!(await requireSuperAdmin(user.id))) {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const admin = createFisioAdminClient();

    // Check if exercise is referenced in any routine (FK is NO ACTION — would fail)
    const [physioRes, gymRes] = await Promise.all([
      admin.from('physio_routine_exercises').select('id', { count: 'exact', head: true }).eq('exercise_id', id),
      admin.from('gym_routine_exercises').select('id', { count: 'exact', head: true }).eq('exercise_id', id),
    ]);

    const usageCount = (physioRes.count ?? 0) + (gymRes.count ?? 0);
    if (usageCount > 0) {
      return NextResponse.json(
        { error: `Este ejercicio está en uso en ${usageCount} rutina${usageCount !== 1 ? 's' : ''} y no puede eliminarse` },
        { status: 409 }
      );
    }

    const { error } = await admin.from('exercises').delete().eq('id', id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /api/fisio/exercises/[id]]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}
