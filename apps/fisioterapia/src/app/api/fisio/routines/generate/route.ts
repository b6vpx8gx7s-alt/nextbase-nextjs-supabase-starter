import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getClientAndContext, createFisioAdminClient } from '../../_helpers';
import { getSafeExercises, postValidate, parseReps } from '@/lib/rutina/safety';
import { buildPrompt } from '@/lib/rutina/prompt';
import type { DraftDia } from '@/lib/fisio-types';

export async function POST(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const supabase = createFisioAdminClient();

    const { client_id } = await request.json();
    if (!client_id) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 });

    // ── 1. Verificar que el cliente pertenece al negocio ──────
    const { data: client } = await supabase
      .from('physio_clients')
      .select('nombre, nivel_fisico, objetivo, dias_disponibles')
      .eq('id', client_id)
      .eq('business_id', ctx.businessId)
      .maybeSingle();

    if (!client) return NextResponse.json({ error: 'Paciente no encontrado' }, { status: 404 });

    const diasCount = (client.dias_disponibles as number[] | null)?.length ?? 3;

    // ── 2. Leer patologías y dolor del cliente ────────────────
    const [pathRes, painRes] = await Promise.all([
      supabase.from('pathologies').select('nombre, zona_corporal').eq('client_id', client_id),
      supabase
        .from('pain_map')
        .select('zona_corporal, mecanica, nivel')
        .eq('client_id', client_id)
        .gte('nivel', 4)
        .order('created_at', { ascending: false }),
    ]);

    // ── 3. Pre-filtro determinista ────────────────────────────
    const safeExercises = await getSafeExercises(client_id, supabase);

    if (safeExercises.length < 5) {
      return NextResponse.json(
        { error: 'No hay suficientes ejercicios seguros para este perfil.' },
        { status: 422 }
      );
    }

    // ── 4. Llamada a Claude ───────────────────────────────────
    const prompt = buildPrompt({
      nombre: (client.nombre as string) ?? '',
      nivel_fisico: (client.nivel_fisico as string) ?? 'principiante',
      objetivo: (client.objetivo as string) ?? 'rehabilitacion',
      dias_count: diasCount,
      pathologies: (pathRes.data ?? []) as { nombre: string; zona_corporal: string }[],
      pain_entries: (painRes.data ?? []) as { zona_corporal: string; mecanica: string; nivel: number }[],
      safeExercises,
    });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';

    // ── 5. Parsear respuesta ──────────────────────────────────
    let draft: { dias: DraftDia[]; notas_generales: string };
    try {
      draft = extractJSON(rawText);
      if (!Array.isArray(draft.dias)) throw new Error("Campo 'dias' no es un array");
    } catch (parseErr) {
      console.error('[routines/generate] parse error:', parseErr);
      return NextResponse.json(
        { error: 'Error al parsear la rutina generada', _raw: rawText.slice(0, 500) },
        { status: 500 }
      );
    }

    // ── 6. Post-validación determinista ──────────────────────
    const validatedDias = postValidate(draft.dias, safeExercises);
    const diasConEjercicios = validatedDias.filter((d) => d.ejercicios.length > 0);

    if (diasConEjercicios.length === 0) {
      return NextResponse.json(
        { error: 'La rutina no superó la validación de seguridad. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    // ── 7. INSERT en physio_routines ──────────────────────────
    const { semana, year } = getISOWeek(new Date());

    const { data: routine, error: routineError } = await supabase
      .from('physio_routines')
      .insert({
        business_id: ctx.businessId,
        client_id,
        semana,
        year,
        routine_data: {
          dias: diasConEjercicios,
          notas_generales: draft.notas_generales ?? null,
        },
        estado: 'generada',
        generated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (routineError || !routine) {
      throw new Error(routineError?.message ?? 'Error al crear rutina');
    }

    // ── 8. INSERT en physio_routine_exercises ─────────────────
    const exerciseRows = diasConEjercicios.flatMap((dia) =>
      dia.ejercicios.map((ej, orden) => ({
        routine_id: routine.id,
        exercise_id: ej.exercise_id,
        dia: Math.min(Math.max(dia.dia_index + 1, 1), 7),
        series: ej.series,
        reps_o_segundos: parseReps(ej.repeticiones),
        tempo: null,
        orden,
        notas_adaptacion: ej.nota ?? null,
      }))
    );

    const { error: exError } = await supabase.from('physio_routine_exercises').insert(exerciseRows);
    if (exError) throw new Error(exError.message);

    return NextResponse.json({
      routine: {
        id: routine.id,
        semana,
        year,
        dias: diasConEjercicios,
        notas_generales: draft.notas_generales ?? null,
        estado: 'generada',
      },
    });
  } catch (err: unknown) {
    console.error('[routines/generate]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Error interno' },
      { status: 500 }
    );
  }
}

function extractJSON(text: string): { dias: DraftDia[]; notas_generales: string } {
  const cleaned = text.trim();
  try {
    return JSON.parse(cleaned);
  } catch { /* sigue */ }

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch { /* sigue */ }
  }

  const start = cleaned.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === '{') depth++;
      else if (cleaned[i] === '}') {
        depth--;
        if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1));
      }
    }
  }

  throw new Error('No se encontró JSON válido en la respuesta de Claude');
}

function getISOWeek(date: Date): { semana: number; year: number } {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const semana = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { semana, year: d.getFullYear() };
}
