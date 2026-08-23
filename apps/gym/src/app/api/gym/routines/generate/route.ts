import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getClientAndContext, createGymAdminClient } from '../../_helpers';
import { getSafeExercises, postValidate, parseReps } from '@/lib/rutina/safety';
import { buildPrompt } from '@/lib/rutina/prompt';
import type { DraftDia } from '@/lib/fisio-types';

export async function POST(request: Request) {
  try {
    const { ctx } = await getClientAndContext();
    if (!ctx) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    const supabase = createGymAdminClient();

    const { client_id } = await request.json();
    if (!client_id) return NextResponse.json({ error: 'client_id requerido' }, { status: 400 });

    // ── 1. Verificar que el cliente pertenece al negocio ──────
    const { data: client } = await supabase
      .from('gym_clients')
      .select('nombre, nivel_entrenamiento, objetivo_principal, dias_disponibles')
      .eq('id', client_id)
      .eq('business_id', ctx.businessId)
      .maybeSingle();

    if (!client) return NextResponse.json({ error: 'Cliente no encontrado' }, { status: 404 });

    const diasCount = (client.dias_disponibles as number[] | null)?.length ?? 3;

    // ── 2. Leer mediciones y objetivos ────────────────────────
    const [measRes, goalsRes] = await Promise.all([
      supabase
        .from('gym_measurements')
        .select('measurement_type, value, unit, measured_at, measurement_types(label, unit_default)')
        .eq('client_id', client_id)
        .eq('business_id', ctx.businessId)
        .order('measured_at', { ascending: false }),
      supabase
        .from('gym_goals')
        .select('descripcion, fecha_objetivo')
        .eq('client_id', client_id)
        .eq('business_id', ctx.businessId)
        .eq('estado', 'activo'),
    ]);

    if (measRes.error) console.warn('[routines/generate] measRes error:', measRes.error.message);
    if (goalsRes.error) console.warn('[routines/generate] goalsRes error:', goalsRes.error.message);

    const seenTypes = new Set<string>();
    const latestMeasurements = (measRes.data ?? [])
      .filter((m) => {
        if (seenTypes.has(m.measurement_type)) return false;
        seenTypes.add(m.measurement_type);
        return true;
      })
      .slice(0, 10)
      .map((m) => {
        const meta = Array.isArray(m.measurement_types)
          ? (m.measurement_types[0] as { label: string; unit_default: string | null } | undefined)
          : (m.measurement_types as { label: string; unit_default: string | null } | null);
        return {
          label: meta?.label ?? m.measurement_type,
          value: m.value as number,
          unit: (m.unit ?? meta?.unit_default ?? null) as string | null,
          measured_at: m.measured_at as string,
        };
      });

    // ── 3. Pre-filtro determinista ────────────────────────────
    // getSafeExercises queries pathologies/pain_map; for gym clients those
    // tables return empty, so all exercises are considered safe.
    const safeExercises = await getSafeExercises(client_id, supabase, ctx.businessId);

    if (safeExercises.length < 5) {
      return NextResponse.json(
        { error: 'No hay suficientes ejercicios en el catálogo.' },
        { status: 422 }
      );
    }

    // ── 4. Llamada a Claude ───────────────────────────────────
    const prompt = buildPrompt({
      nombre: (client.nombre as string) ?? '',
      nivel_entrenamiento: (client.nivel_entrenamiento as string) ?? 'novato',
      objetivo_principal: (client.objetivo_principal as string) ?? 'hipertrofia',
      dias_count: diasCount,
      safeExercises,
      measurements: latestMeasurements,
      goals: (goalsRes.data ?? []) as { descripcion: string; fecha_objetivo: string | null }[],
    });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    });

    const rawText = message.content[0].type === 'text' ? message.content[0].text : '';

    console.log('[routines/generate] stop_reason:', message.stop_reason);
    console.log('[routines/generate] rawText (first 800):', rawText.slice(0, 800));

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
    console.log('[routines/generate] validatedDias count:', validatedDias.length, '| diasConEjercicios:', diasConEjercicios.length);

    if (diasConEjercicios.length === 0) {
      return NextResponse.json(
        { error: 'La rutina no superó la validación. Intenta de nuevo.' },
        { status: 500 }
      );
    }

    // ── 7. INSERT en gym_routines ─────────────────────────────
    const { semana, year } = getISOWeek(new Date());

    const { data: routine, error: routineError } = await supabase
      .from('gym_routines')
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

    // ── 8. INSERT en gym_routine_exercises ────────────────────
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

    const { error: exError } = await supabase.from('gym_routine_exercises').insert(exerciseRows);
    if (exError) throw new Error(exError.message);

    return NextResponse.json({
      routine: {
        id: routine.id,
        client_id,
        semana,
        year,
        routine_data: {
          dias: diasConEjercicios,
          notas_generales: draft.notas_generales ?? null,
        },
        estado: 'generada',
        generated_at: new Date().toISOString(),
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
