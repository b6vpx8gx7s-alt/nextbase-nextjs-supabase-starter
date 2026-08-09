import type { SafeExercise } from '@/lib/fisio-types';

interface PromptContext {
  nombre: string;
  nivel_fisico: string;
  objetivo: string;
  dias_count: number;
  pathologies: { nombre: string; zona_corporal: string }[];
  pain_entries: { zona_corporal: string; mecanica: string; nivel: number }[];
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
  cardio: 'Cardio suave',
  movilidad: 'Movilidad',
};

const OBJETIVO_LABEL: Record<string, string> = {
  rehabilitacion: 'rehabilitacion y fisioterapia',
  movilidad: 'mejorar movilidad y flexibilidad',
  fuerza: 'ganar fuerza y masa muscular',
  cardio: 'mejorar resistencia cardiovascular',
  perder_peso: 'perder peso',
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

  const pathStr =
    ctx.pathologies.length > 0
      ? ctx.pathologies
          .map((p) => '  - ' + p.nombre + ' (zona: ' + p.zona_corporal + ')')
          .join('\n')
      : '  - Ninguna';

  const painStr =
    ctx.pain_entries.length > 0
      ? ctx.pain_entries
          .map(
            (p) =>
              '  - ' + p.zona_corporal + ': nivel ' + p.nivel + '/10, aparece ' + p.mecanica
          )
          .join('\n')
      : '  - Ninguno';

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

  const objetivo = OBJETIVO_LABEL[ctx.objetivo] ?? ctx.objetivo.replace('_', ' ');

  return [
    'Eres un fisioterapeuta y entrenador especializado en fitness adaptado para personas con condiciones fisicas especiales.',
    '',
    'PERFIL DEL PACIENTE:',
    '- Nombre: ' + (ctx.nombre || 'Paciente'),
    '- Nivel fisico: ' + ctx.nivel_fisico,
    '- Objetivo principal: ' + objetivo,
    '- Dias de entrenamiento por semana: ' + ctx.dias_count,
    '',
    'CONDICIONES MEDICAS (el sistema de seguridad ya excluyo los ejercicios peligrosos):',
    'Patologias:',
    pathStr,
    '',
    'Zonas de dolor activo (nivel >= 4/10):',
    painStr,
    '',
    'HISTORIAL CLINICO RECIENTE (ultima medicion por tipo):',
    measStr,
    '',
    'OBJETIVOS TERAPEUTICOS ACTIVOS:',
    goalsStr,
    '',
    'REGLAS ESTRICTAS:',
    '1. Genera exactamente ' + ctx.dias_count + ' dias de entrenamiento para una semana.',
    '2. USA UNICAMENTE los ejercicios del catalogo de abajo. NO inventes ejercicios ni uses IDs distintos.',
    '3. Los ejercicios con [PRECAUCION] DEBEN llevar una "nota" de modificacion explicita.',
    '4. Cada dia: entre 4 y 7 ejercicios. Incluye al menos un ejercicio de movilidad.',
    '5. Alterna grupos musculares entre dias para permitir recuperacion.',
    '6. Adapta series/repeticiones al nivel ' + ctx.nivel_fisico + ' y al objetivo ' + objetivo + '.',
    '7. Ten en cuenta el historial clinico al disenar el plan:',
    '   - Si el EVA de dolor es >= 6, prioriza ejercicios de baja carga e intensidad.',
    '   - Usa los ROM registrados para seleccionar rangos de movimiento alcanzables (no exijas mas ROM del medido).',
    '   - Orienta la progresion de series/reps y la seleccion de ejercicios hacia los objetivos terapeuticos activos.',
    '   - Menciona el historial clinico relevante en las notas_generales del plan.',
    '',
    'CATALOGO DE EJERCICIOS PERMITIDOS (solo puedes usar estos):',
    catalogLines,
    '',
    'Tu respuesta debe ser EXCLUSIVAMENTE el objeto JSON (sin texto adicional, sin markdown, sin bloques de codigo).',
    'Esquema requerido:',
    '  dias: array de ' + ctx.dias_count + ' objetos, cada uno con:',
    '    dia_index (number, 0-based)',
    '    nombre (string, ej: "Dia 1 - Tren superior")',
    '    ejercicios: array de 4-7 objetos, cada uno con:',
    '      exercise_id (string, UUID exacto del catalogo)',
    '      nombre (string, nombre exacto del catalogo)',
    '      series (number)',
    '      repeticiones (string, ej: "10-12" o "30 seg")',
    '      descanso_seg (number)',
    '      nota (string, solo si el ejercicio tiene [PRECAUCION]; omite si no aplica)',
    '  notas_generales (string, resumen del plan y recomendaciones para este paciente)',
  ].join('\n');
}
