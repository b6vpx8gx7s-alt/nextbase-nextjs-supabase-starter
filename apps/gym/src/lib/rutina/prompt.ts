import type { SafeExercise } from '@/lib/fisio-types';

interface PromptContext {
  nombre: string;
  nivel_entrenamiento: string;
  objetivo_principal: string;
  dias_count: number;
  safeExercises: SafeExercise[];
  measurements: { label: string; value: number; unit: string | null; measured_at: string }[];
  goals: { descripcion: string; fecha_objetivo: string | null }[];
}

const PATRON_LABEL: Record<string, string> = {
  empuje_horizontal: 'Empuje horizontal',
  empuje_vertical: 'Empuje vertical',
  tiron_horizontal: 'Tiron horizontal',
  tiron_vertical: 'Tiron vertical',
  sentadilla: 'Sentadilla',
  bisagra: 'Bisagra',
  zancada: 'Zancada',
  core_anti_extension: 'Core anti-extension',
  core_anti_rotacion: 'Core anti-rotacion',
  cardio: 'Cardio',
  movilidad: 'Movilidad',
};

const OBJETIVO_LABEL: Record<string, string> = {
  hipertrofia: 'ganar masa muscular e hipertrofia',
  perdida_grasa: 'pérdida de grasa y recomposición corporal',
  fuerza: 'desarrollar fuerza máxima',
  resistencia: 'mejorar resistencia cardiovascular y muscular',
  rendimiento: 'mejorar rendimiento deportivo',
};

export function buildPrompt(ctx: PromptContext): string {
  const byPatron: Record<string, SafeExercise[]> = {};
  for (const ex of ctx.safeExercises) {
    const key = ex.patron || 'otros';
    if (!byPatron[key]) byPatron[key] = [];
    byPatron[key].push(ex);
  }

  const catalogLines = Object.entries(byPatron)
    .map(([patron, exs]) => {
      const label = PATRON_LABEL[patron] ?? patron;
      const items = exs.map((e) => {
        const caution =
          e.caution_notes.length > 0
            ? ' [PRECAUCION: ' + e.caution_notes.join('; ') + ']'
            : '';
        return (
          '    - ' +
          e.nombre +
          ' | id:' +
          e.id +
          ' | nivel:' +
          e.nivel +
          ' | equipo:' +
          e.equipo +
          caution
        );
      });
      return '  ' + label + ':\n' + items.join('\n');
    })
    .join('\n\n');

  const measStr =
    ctx.measurements.length > 0
      ? ctx.measurements
          .map((m) => {
            const unit = m.unit ? ' ' + m.unit : '';
            const date = new Date(m.measured_at + 'T00:00:00').toLocaleDateString('es-CL', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            });
            return '  - ' + m.label + ': ' + m.value + unit + ' (' + date + ')';
          })
          .join('\n')
      : '  - Sin mediciones registradas';

  const goalsStr =
    ctx.goals.length > 0
      ? ctx.goals
          .map((g) => '  - ' + g.descripcion + (g.fecha_objetivo ? ' → ' + g.fecha_objetivo : ''))
          .join('\n')
      : '  - Sin objetivos definidos';

  const objetivo = OBJETIVO_LABEL[ctx.objetivo_principal] ?? ctx.objetivo_principal.replace('_', ' ');

  return [
    'Eres un entrenador personal especializado en fitness y musculación.',
    '',
    'PERFIL DEL ATLETA:',
    '- Nombre: ' + (ctx.nombre || 'Atleta'),
    '- Nivel de entrenamiento: ' + ctx.nivel_entrenamiento,
    '- Objetivo principal: ' + objetivo,
    '- Dias de entrenamiento por semana: ' + ctx.dias_count,
    '',
    'MEDICIONES RECIENTES (ultima medicion por tipo):',
    measStr,
    '',
    'OBJETIVOS ACTIVOS:',
    goalsStr,
    '',
    'REGLAS ESTRICTAS:',
    '1. Genera exactamente ' + ctx.dias_count + ' dias de entrenamiento para una semana.',
    '2. USA UNICAMENTE los ejercicios del catalogo de abajo. NO inventes ejercicios ni uses IDs distintos.',
    '3. Los ejercicios con [PRECAUCION] DEBEN llevar una "nota" de modificacion explicita.',
    '4. Cada dia: entre 4 y 8 ejercicios.',
    '5. Alterna grupos musculares entre dias para permitir recuperacion.',
    '6. Adapta series/repeticiones al nivel ' + ctx.nivel_entrenamiento + ' y al objetivo ' + objetivo + '.',
    '7. Ten en cuenta las mediciones y objetivos al disenar el plan.',
    '',
    'CATALOGO DE EJERCICIOS PERMITIDOS (solo puedes usar estos):',
    catalogLines,
    '',
    'Tu respuesta debe ser EXCLUSIVAMENTE el objeto JSON (sin texto adicional, sin markdown, sin bloques de codigo).',
    'Esquema requerido:',
    '  dias: array de ' + ctx.dias_count + ' objetos, cada uno con:',
    '    dia_index (number, 0-based)',
    '    nombre (string, ej: "Dia 1 - Tren superior")',
    '    ejercicios: array de 4-8 objetos, cada uno con:',
    '      exercise_id (string, UUID exacto del catalogo)',
    '      nombre (string, nombre exacto del catalogo)',
    '      series (number)',
    '      repeticiones (string, ej: "10-12" o "30 seg")',
    '      descanso_seg (number)',
    '      nota (string, solo si el ejercicio tiene [PRECAUCION]; omite si no aplica)',
    '  notas_generales (string, resumen del plan y recomendaciones para este atleta)',
  ].join('\n');
}
