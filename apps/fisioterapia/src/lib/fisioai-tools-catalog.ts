import Anthropic from '@anthropic-ai/sdk'
import { createFisioAdminClient } from '@/app/api/fisio/_helpers'
import { type FisioAIBusinessContext } from './fisioai-business'
import { type FisioAITool, type FisioAIToolInput } from './fisioai-tools'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const suggestFisioContextTool: FisioAITool = {
  name: 'suggest_fisio_context',
  description:
    'Analiza un lote de ejercicios del catálogo de gym y sugiere cuáles también serían adecuados para protocolos de fisioterapia y rehabilitación, para revisión y aprobación posterior',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Cantidad de ejercicios de gym a analizar en este lote (default 10)',
      },
      forceReprocess: {
        type: 'boolean',
        description:
          'Si es true, reprocesa ejercicios aunque ya tengan sugerencias previas. Útil para comparar resultados.',
      },
    },
    required: [],
  },
  execute: async (_context: FisioAIBusinessContext, params: FisioAIToolInput) => {
    const supabase = createFisioAdminClient()
    const batchLimit = (params.limit as number) || 10
    const forceReprocess = (params.forceReprocess as boolean) || false

    type ExerciseRow = {
      id: string
      nombre: string
      patron: string
      grupo_muscular: string
      equipo: string
      descripcion_breve: string
    }
    let pending: ExerciseRow[]

    if (forceReprocess) {
      const { data } = await supabase
        .from('exercises')
        .select('id, nombre, patron, grupo_muscular, equipo, descripcion_breve')
        .eq('context', 'gym')
        .order('id')
        .limit(batchLimit)
      pending = (data ?? []) as ExerciseRow[]
    } else {
      const { data: alreadySuggested } = await supabase
        .from('fisio_context_suggestions')
        .select('exercise_id')
      const alreadyDoneIds = new Set((alreadySuggested ?? []).map((s) => s.exercise_id as string))

      // Fetch a large pool and shuffle so each batch mixes different
      // patrons/muscle groups, reducing inter-item "contagion" bias.
      const { data } = await supabase
        .from('exercises')
        .select('id, nombre, patron, grupo_muscular, equipo, descripcion_breve')
        .eq('context', 'gym')
        .limit(batchLimit * 8)

      if (!data || data.length === 0) {
        return { success: true, processed: 0, message: 'No hay ejercicios de gym en el catálogo' }
      }

      const unprocessed = data.filter((e) => !alreadyDoneIds.has(e.id as string))

      // Fisher-Yates shuffle so each batch spans varied patterns/groups
      for (let j = unprocessed.length - 1; j > 0; j--) {
        const k = Math.floor(Math.random() * (j + 1))
        ;[unprocessed[j], unprocessed[k]] = [unprocessed[k], unprocessed[j]]
      }

      pending = unprocessed.slice(0, batchLimit) as ExerciseRow[]
    }

    if (pending.length === 0) {
      return {
        success: true,
        processed: 0,
        message: 'Todos los ejercicios de gym ya tienen sugerencias de contexto generadas',
      }
    }

    let totalSuggestions = 0

    for (let i = 0; i < pending.length; i += 10) {
      const grupo = pending.slice(i, i + 10)

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: `Eres un fisioterapeuta clínico evaluando qué ejercicios de gimnasio podrían integrarse en protocolos de fisioterapia y rehabilitación.

Ejercicios a evaluar (todos son actualmente solo de gym):
${grupo
  .map(
    (e, idx) =>
      `${idx + 1}. ${e.nombre} (patrón: ${e.patron}, grupo muscular: ${e.grupo_muscular}, equipo: ${e.equipo})
   Movimiento: ${e.descripcion_breve}`
  )
  .join('\n\n')}

CRITERIO: Un ejercicio es apto para fisioterapia cuando: (1) se usa en protocolos de rehab estándar, (2) permite ajuste de carga/rango muy bajo o se hace con peso corporal, (3) aísla el músculo de forma controlada. NO es apto si es principalmente un movimiento compuesto de fuerza máxima, deporte de alto rendimiento, o requiere carga axial alta.

EJEMPLOS DE CALIBRACIÓN (generales):
- "Curl de bíceps con mancuerna" → SÍ (rehab de codo/hombro, control aislado de carga)
- "Extensión de rodilla en máquina" → SÍ (rehab de rodilla estándar en fisio)
- "Elevación lateral de hombro" → SÍ (rehab de manguito rotador)
- "Extensión de tríceps en polea" → SÍ (rehab de codo, control aislado)
- "Abducción de cadera con banda" → SÍ (rehab de cadera/glúteo)
- "Peso muerto convencional" → NO (compuesto de fuerza máxima, no es protocolo de rehab)
- "Press de banca" → NO (compuesto de pecho, no típico en fisio)
- "Sentadilla con barra" → NO (compuesto de alta carga)
- "Clean and jerk" → NO (movimiento olímpico de potencia)
- "Dominadas con lastre" → NO (alta carga relativa)

EJEMPLOS DE CALIBRACIÓN (core/abdominales — distingue por variable específica):
- "Abdominales asistidos" (máquina o con asistencia) → SÍ, motivo: "Permite reducir la carga y controlar el rango de movimiento, apropiado para fases tempranas de rehabilitación de core"
- "Abdominales 3/4" (rango parcial, sin equipo) → SÍ, motivo: "Rango de movimiento reducido disminuye la tensión en zona lumbar, apropiado para rehabilitación"
- "Abdominales completos con brazos arriba" (rango completo, brazos extendidos aumentan palanca) → NO, motivo: "Brazos extendidos incrementan la palanca sobre la columna lumbar; existen alternativas de menor riesgo para rehabilitación"
- "Abdominales declinados ponderados" (banco declinado + peso) → NO, motivo: "Banco declinado y peso añadido combinan mayor palanca y carga externa, excediendo lo apropiado para protocolos de rehab estándar"

INSTRUCCIÓN DE CONSISTENCIA ENTRE VARIANTES: Cuando dos ejercicios sean variantes del mismo movimiento base, tu criterio de diferenciación debe ser explícito y consistente. Identifica qué variable específica (rango de movimiento, palanca, asistencia, carga externa, equipo) hace que uno sea apropiado y el otro no, y menciona esa variable tanto en el motivo del aprobado como en el motivo del descartado.

Compara los ${grupo.length} ejercicios entre sí. La MAYORÍA de ejercicios de gym NO son protocolos de fisioterapia. Solo marca como apto lo que genuinamente encontrarías en un programa de rehabilitación clínica. Sé conservador — si dudas, NO lo marques.

IMPORTANTE: Para TODOS los ejercicios (tanto aptos como no aptos) incluye un motivo breve. Esto permite auditar la calidad de los descartes.

Responde SOLO JSON, sin markdown, un array con un objeto por cada ejercicio del 1 al ${grupo.length}:
{
  "results": [
    { "index": 1, "apto": true, "motivo": "breve razón clínica de por qué es útil en rehab (máx 20 palabras)" },
    { "index": 2, "apto": false, "motivo": "breve razón de por qué no aplica en rehab (máx 15 palabras)" }
  ]
}`,
          },
        ],
      })

      try {
        const textContent = response.content[0]
        if (textContent.type === 'text') {
          const cleaned = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const parsed = JSON.parse(cleaned) as {
            results?: Array<{ index: number; apto: boolean; motivo?: string }>
          }

          for (const item of parsed.results ?? []) {
            const ex = grupo[item.index - 1]
            if (!ex) continue

            const { error } = await supabase.from('fisio_context_suggestions').insert({
              exercise_id: ex.id,
              exercise_nombre: ex.nombre,
              grupo_muscular: ex.grupo_muscular,
              patron: ex.patron,
              motivo: item.motivo ?? null,
              status: item.apto ? 'pending' : 'no_match',
            })
            if (!error && item.apto) totalSuggestions++
            else if (error) console.error('[FisioAI] Error insertando sugerencia de contexto:', error)
          }
        }
      } catch (parseError) {
        console.error(
          `[FisioAI] Error parsing fisio context suggestions for group at index ${i}:`,
          parseError
        )
      }
    }

    return {
      success: true,
      processed: pending.length,
      totalSuggestions,
      message: `Procesados ${pending.length} ejercicios de gym, ${totalSuggestions} candidatos para fisioterapia identificados y enviados a revisión`,
    }
  },
}
