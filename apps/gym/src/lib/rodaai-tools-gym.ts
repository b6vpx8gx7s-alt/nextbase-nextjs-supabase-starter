import Anthropic from '@anthropic-ai/sdk'
import { createGymAdminClient } from '@/app/api/gym/_helpers';
import { parseReps } from '@/lib/rutina/safety';
import { type RodaAIBusinessContext } from './rodaai-business';
import { type RodaAITool, type RodaAIToolInput } from './rodaai-tools';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const getClientProfileTool: RodaAITool = {
  name: 'get_client_profile',
  description:
    'Obtiene el perfil completo del cliente de gym (edad, objetivo, lesiones, disponibilidad, etc)',
  category: 'gym',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'UUID del cliente gym' },
    },
    required: ['clientId'],
  },
  execute: async (context: RodaAIBusinessContext, params: RodaAIToolInput) => {
    const supabase = createGymAdminClient();
    const clientId = params.clientId as string;

    if (context.userRole === 'trainer') {
      const { data: client } = await supabase
        .from('gym_clients')
        .select('id')
        .eq('id', clientId)
        .eq('business_id', context.businessId)
        .maybeSingle();
      if (!client) throw new Error(`Unauthorized: Cannot access client ${clientId}`);
    }
    if (context.userRole === 'client' && context.clientIdentifier !== clientId) {
      throw new Error('Unauthorized: Cannot access other clients');
    }

    const { data: profile, error } = await supabase
      .from('gym_clients')
      .select(
        `id, nombre, email, telefono, fecha_nacimiento, sexo,
         nivel_entrenamiento, tiempo_entrenando, objetivo_principal,
         dias_disponibles, horario_laboral, hora_despertar, hora_dormir,
         hora_entrenar, deporte_alterno, usa_esteroides,
         problema_cardiovascular, lesion_actual, zona_a_mejorar, notas`
      )
      .eq('id', clientId)
      .single();

    if (error) throw error;

    return {
      success: true,
      profile: {
        id: profile.id,
        nombre: profile.nombre,
        email: profile.email,
        telefono: profile.telefono,
        edad: profile.fecha_nacimiento
          ? new Date().getFullYear() - new Date(profile.fecha_nacimiento as string).getFullYear()
          : null,
        objetivo: profile.objetivo_principal,
        nivel: profile.nivel_entrenamiento,
        lesion: profile.lesion_actual,
        problema_cardiovascular: profile.problema_cardiovascular,
        disponibilidad: `${(profile.dias_disponibles as number[] | null)?.join(', ')} a las ${profile.hora_entrenar}`,
        deporte_alterno: profile.deporte_alterno,
        notas: profile.notas,
      },
    };
  },
};

export const getActiveRoutinesTool: RodaAITool = {
  name: 'get_active_routines',
  description: 'Obtiene las rutinas activas vigentes del cliente',
  category: 'gym',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'UUID del cliente' },
    },
    required: ['clientId'],
  },
  execute: async (context: RodaAIBusinessContext, params: RodaAIToolInput) => {
    const supabase = createGymAdminClient();
    const clientId = params.clientId as string;

    if (context.userRole === 'trainer') {
      const { data: client } = await supabase
        .from('gym_clients')
        .select('id')
        .eq('id', clientId)
        .eq('business_id', context.businessId)
        .maybeSingle();
      if (!client) throw new Error('Unauthorized');
    }
    if (context.userRole === 'client' && context.clientIdentifier !== clientId) {
      throw new Error('Unauthorized');
    }

    const { data: routines, error } = await supabase
      .from('gym_routines')
      .select('id, semana, year, routine_data, estado, generated_at')
      .eq('client_id', clientId)
      .eq('estado', 'activa')
      .order('generated_at', { ascending: false });

    if (error) throw error;

    return {
      success: true,
      count: routines?.length ?? 0,
      routines: routines?.map((r) => ({
        id: r.id,
        semana: r.semana,
        year: r.year,
        generada: r.generated_at,
        estado: r.estado,
        ejercicios_count: r.routine_data ? Object.keys(r.routine_data).length : 0,
      })),
    };
  },
};

export const getWorkoutHistoryTool: RodaAITool = {
  name: 'get_workout_history',
  description: 'Obtiene el historial de entrenamientos del cliente (últimas 10 sesiones)',
  category: 'gym',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'UUID del cliente' },
    },
    required: ['clientId'],
  },
  execute: async (context: RodaAIBusinessContext, params: RodaAIToolInput) => {
    const supabase = createGymAdminClient();
    const clientId = params.clientId as string;

    if (context.userRole === 'trainer') {
      const { data: client } = await supabase
        .from('gym_clients')
        .select('id')
        .eq('id', clientId)
        .eq('business_id', context.businessId)
        .maybeSingle();
      if (!client) throw new Error('Unauthorized');
    }
    if (context.userRole === 'client' && context.clientIdentifier !== clientId) {
      throw new Error('Unauthorized');
    }

    const { data: sessions, error } = await supabase
      .from('gym_workout_sessions')
      .select(
        `id, trained_at, notas,
         gym_set_logs ( id, exercise_id, set_num, reps_o_seg, peso_kg )`
      )
      .eq('client_id', clientId)
      .order('trained_at', { ascending: false })
      .limit(10);

    if (error) throw error;

    return {
      success: true,
      count: sessions?.length ?? 0,
      sessions: sessions?.map((s) => ({
        id: s.id,
        fecha: s.trained_at,
        notas: s.notas,
        sets_count: s.gym_set_logs?.length ?? 0,
      })),
    };
  },
};

export const searchClientsTool: RodaAITool = {
  name: 'search_clients',
  description: 'Busca y lista clientes por nombre o retorna todos si la búsqueda está vacía',
  category: 'gym',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Nombre del cliente a buscar (vacío para listar todos)',
      },
    },
    required: ['name'],
  },
  execute: async (context: RodaAIBusinessContext, params: RodaAIToolInput) => {
    const supabase = createGymAdminClient();
    const searchName = params.name as string;

    let query = supabase
      .from('gym_clients')
      .select('id, nombre, email, objetivo_principal, nivel_entrenamiento')
      .eq('business_id', context.businessId);

    if (searchName?.trim()) {
      query = query.ilike('nombre', `%${searchName}%`);
    }

    const { data: clients, error } = await query.order('nombre').limit(20);

    if (error) throw error;

    return {
      success: true,
      count: clients?.length ?? 0,
      clients: clients ?? [],
    };
  },
};

export const getClientAlertsTool: RodaAITool = {
  name: 'get_client_alerts',
  description: 'Obtiene clientes que requieren atención (sin rutina, inactivos, sin actividad)',
  category: 'gym',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (context: RodaAIBusinessContext, _params: RodaAIToolInput) => {
    const supabase = createGymAdminClient();

    // Todos los clientes del negocio
    const { data: allClients } = await supabase
      .from('gym_clients')
      .select('id, nombre')
      .eq('business_id', context.businessId);

    const clientIds = (allClients ?? []).map((c) => c.id as string);

    // IDs con rutina activa
    const { data: activeRoutines } = await supabase
      .from('gym_routines')
      .select('client_id')
      .eq('business_id', context.businessId)
      .in('estado', ['activa', 'generada']);

    const withActiveRoutine = new Set((activeRoutines ?? []).map((r) => r.client_id as string));
    const noRoutineClients = (allClients ?? []).filter((c) => !withActiveRoutine.has(c.id as string));

    // Sesiones de las últimas 2 semanas
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    const { data: recentSessions } = clientIds.length
      ? await supabase
          .from('gym_workout_sessions')
          .select('client_id, trained_at')
          .eq('business_id', context.businessId)
          .gte('trained_at', twoWeeksAgo.toISOString().split('T')[0])
      : { data: [] };

    const withRecentSession = new Set((recentSessions ?? []).map((s) => s.client_id as string));

    const { data: anySessions } = clientIds.length
      ? await supabase
          .from('gym_workout_sessions')
          .select('client_id')
          .eq('business_id', context.businessId)
      : { data: [] };

    const withAnySession = new Set((anySessions ?? []).map((s) => s.client_id as string));

    const inactiveClients = (allClients ?? []).filter(
      (c) => withAnySession.has(c.id as string) && !withRecentSession.has(c.id as string)
    );
    const noActivityClients = (allClients ?? []).filter((c) => !withAnySession.has(c.id as string));

    return {
      success: true,
      alerts: {
        noRoutine: {
          count: noRoutineClients.length,
          clients: noRoutineClients,
          description: 'Clientes sin rutina vigente',
        },
        inactive: {
          count: inactiveClients.length,
          clients: inactiveClients,
          description: 'Clientes inactivos (últimas 2 semanas)',
        },
        noActivity: {
          count: noActivityClients.length,
          clients: noActivityClients,
          description: 'Clientes sin actividad registrada',
        },
      },
      totalAlerts: noRoutineClients.length + inactiveClients.length + noActivityClients.length,
    };
  },
};

export const analyzeInjuryNotesTool: RodaAITool = {
  name: 'analyze_injury_notes',
  description: 'Detecta automáticamente lesiones/dolor en notas de sesiones de entrenamiento',
  category: 'gym',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (context: RodaAIBusinessContext) => {
    const supabase = createGymAdminClient()

    const { data: clients } = await supabase
      .from('gym_clients')
      .select('id, nombre')
      .eq('business_id', context.businessId)

    if (!clients || clients.length === 0) {
      return {
        success: true,
        injuries: [],
        totalDetected: 0,
        message: 'No hay clientes registrados',
      }
    }

    const clientIds = clients.map((c) => c.id as string)
    const clientMap = Object.fromEntries(clients.map((c) => [c.id as string, c.nombre as string]))

    // Query directo desde sesiones para evitar join anidado triple que puede fallar
    const { data: sessions } = await supabase
      .from('gym_workout_sessions')
      .select('id, client_id, trained_at, gym_set_logs ( nota, created_at )')
      .in('client_id', clientIds)

    // Agrupar notas por cliente
    const notesByClient: Record<string, Array<{ nota: string; sessionDate: string }>> = {}
    for (const session of sessions ?? []) {
      const cid = session.client_id as string
      if (!notesByClient[cid]) notesByClient[cid] = []
      for (const log of (session.gym_set_logs as Array<{ nota: string | null; created_at: string }> | null) ?? []) {
        if (log.nota && log.nota.trim()) {
          notesByClient[cid].push({ nota: log.nota, sessionDate: session.trained_at as string })
        }
      }
    }

    const injuries: Array<{
      clientId: string
      clientName: string
      injuryType: string
      description: string
      detectedIn: string
      sessionDate: string
      confidence: 'high' | 'medium' | 'low'
    }> = []

    for (const clientId of clientIds) {
      const allNotes = notesByClient[clientId] ?? []

      if (allNotes.length > 0) {
        const notesText = allNotes.map((n) => `[${n.sessionDate}] ${n.nota}`).join('\n')

        const response = await anthropic.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          messages: [
            {
              role: 'user',
              content: `Analiza estas notas de sesiones de entrenamiento y detecta CUALQUIER mención de lesión, dolor, molestia o limitación. Responde SOLO en JSON válido, sin markdown:

${notesText}

Responde así:
{
  "injuries": [
    {
      "type": "tipo de lesión",
      "description": "descripción breve",
      "detectedIn": "texto original donde se menciona",
      "confidence": "high|medium|low"
    }
  ],
  "hasProblem": boolean
}

Si no hay lesiones, retorna {"injuries": [], "hasProblem": false}`,
            },
          ],
        })

        try {
          const textContent = response.content[0]
          if (textContent.type === 'text') {
            const cleanedText = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
            const analysisResult = JSON.parse(cleanedText)

            if (analysisResult.injuries && analysisResult.injuries.length > 0) {
              for (const injury of analysisResult.injuries) {
                injuries.push({
                  clientId,
                  clientName: clientMap[clientId] ?? clientId,
                  injuryType: injury.type,
                  description: injury.description,
                  detectedIn: injury.detectedIn.substring(0, 100),
                  sessionDate: allNotes[0].sessionDate,
                  confidence: injury.confidence,
                })
              }
            }
          }
        } catch (parseError) {
          console.error(`[RodaAI] Error parsing Claude response for ${clientMap[clientId] ?? clientId}:`, parseError)
        }
      }
    }

    return {
      success: true,
      injuries,
      totalDetected: injuries.length,
      summary: injuries.length > 0
        ? `Detectadas ${injuries.length} lesiones/molestias potenciales`
        : 'No se detectaron lesiones en las notas disponibles',
    }
  },
}

export const detectRoutineConflictsTool: RodaAITool = {
  name: 'detect_routine_conflicts',
  description: 'Detecta conflictos entre limitaciones de clientes y ejercicios en sus rutinas',
  category: 'gym',
  inputSchema: {
    type: 'object',
    properties: {
      clientName: {
        type: 'string',
        description: 'Nombre del cliente a analizar (opcional, si se omite analiza todos)',
      },
    },
    required: [],
  },
  execute: async (context: RodaAIBusinessContext, params: RodaAIToolInput) => {
    const supabase = createGymAdminClient();
    const clientNameFilter = params.clientName as string | undefined;

    let clientsQuery = supabase
      .from('gym_clients')
      .select(
        `id, nombre, lesion_actual, problema_cardiovascular, zona_a_mejorar,
         gym_routines ( id, semana, routine_data, estado, generated_at )`
      )
      .eq('business_id', context.businessId);

    if (clientNameFilter?.trim()) {
      clientsQuery = clientsQuery.ilike('nombre', `%${clientNameFilter}%`);
    }

    const { data: clients } = await clientsQuery;

    if (!clients || clients.length === 0) {
      return { success: true, conflicts: [], totalConflicts: 0, message: 'No hay clientes registrados' };
    }

    const conflicts: Array<{
      clientId: string;
      clientName: string;
      limitation: string;
      conflictingExercises: string[];
      routineWeek: number;
      recommendation: string;
      severity: 'high' | 'medium' | 'low';
    }> = [];

    for (const client of clients) {
      if (!client.lesion_actual && !client.problema_cardiovascular && !client.zona_a_mejorar) continue;

      const limitations = [client.lesion_actual, client.problema_cardiovascular, client.zona_a_mejorar]
        .filter((l) => l && (l as string).trim())
        .join(', ');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allRoutines = (client.gym_routines as any[]) ?? [];
      const routine = allRoutines
        .filter((r) => r.estado === 'activa' || r.estado === 'generada')
        .sort((a, b) => new Date(b.generated_at).getTime() - new Date(a.generated_at).getTime())[0];

      if (routine) {

        let exerciseNames: string[] = [];
        let exerciseNotes: string[] = [];
        if (routine.routine_data && typeof routine.routine_data === 'object') {
          const routineObj = routine.routine_data as { dias?: Array<{ ejercicios?: Array<{ nombre: string; nota?: string }> }> };
          if (routineObj.dias) {
            for (const dia of routineObj.dias) {
              if (dia.ejercicios) {
                for (const ejercicio of dia.ejercicios) {
                  exerciseNames.push(ejercicio.nombre);
                  if (ejercicio.nota) {
                    exerciseNotes.push(`${ejercicio.nombre}: ${ejercicio.nota}`);
                  }
                }
              }
            }
          }
        }

        if (exerciseNames.length === 0) continue;

        try {
          const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            messages: [
              {
                role: 'user',
                content: `ANÁLISIS DE SEGURIDAD DE EJERCICIOS

Cliente: ${client.nombre}
Limitaciones: ${limitations}
Ejercicios: ${exerciseNames.join(', ')}
${exerciseNotes.length > 0 ? `\nNotas existentes en la rutina:\n${exerciseNotes.join('\n')}` : ''}

MAPA DE RIESGOS POR LIMITACIÓN:
- Dolor/lesión de RODILLA: evitar sentadillas, leg press, extensiones de pierna, saltos
- Dolor/lesión de ESPALDA: evitar remo, peso muerto, hiperextensiones, flexiones profundas
- Dolor/lesión de HOMBRO: evitar press, laterales, dominadas
- Problema CARDIOVASCULAR: evitar cardio intenso, circuitos pesados

Revisa CADA ejercicio:
1. ¿Están las limitaciones del cliente en "${limitations}"?
2. ¿Están los ejercicios en "${exerciseNames.join(', ')}"?
3. ¿Hay coincidencia en el mapa de riesgos arriba?

Responde SOLO JSON:
{
  "hasConflict": boolean,
  "analysis": [{"exercise": "nombre", "limitation": "limitación", "risk": "descripción"}],
  "recommendation": "qué cambiar",
  "severity": "high|medium|low"
}

IMPORTANTE: Responde con JSON breve y compacto. Máximo 2 ejercicios en conflictingExercises. Explanation y recommendation de máximo 20 palabras cada uno.`,
              },
            ],
          });

          const textContent = response.content[0];
          if (textContent.type === 'text') {
            const cleanedText = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
            const analysisResult = JSON.parse(cleanedText);
            if (analysisResult.hasConflict) {
              conflicts.push({
                clientId: client.id as string,
                clientName: client.nombre as string,
                limitation: limitations,
                conflictingExercises: (analysisResult.analysis ?? []).map((a: { exercise: string }) => a.exercise),
                routineWeek: routine.semana as number,
                recommendation: analysisResult.recommendation,
                severity: analysisResult.severity,
              });
            }
          }
        } catch (parseError) {
          console.error(`[RodaAI] Error parsing Claude response for ${client.nombre}:`, parseError);
        }
      }
    }

    return {
      success: true,
      conflicts,
      totalConflicts: conflicts.length,
      summary: conflicts.length > 0
        ? `Detectados ${conflicts.length} conflictos potenciales`
        : 'No se detectaron conflictos entre limitaciones y rutinas',
    };
  },
};

export const detectLimitationFromSessionsTool: RodaAITool = {
  name: 'detect_limitation_from_sessions',
  description: 'Analiza notas recientes de sesiones para detectar menciones de lesiones o limitaciones nuevas y las registra como sugerencias pendientes de aprobación',
  category: 'gym',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (context: RodaAIBusinessContext) => {
    const supabase = createGymAdminClient()

    const { data: clients } = await supabase
      .from('gym_clients')
      .select('id, nombre')
      .eq('business_id', context.businessId)

    if (!clients || clients.length === 0) {
      return { success: true, newSuggestions: 0, message: 'No hay clientes registrados' }
    }

    const clientIds = clients.map((c) => c.id)

    const { data: sessions } = await supabase
      .from('gym_workout_sessions')
      .select('id, client_id, notas, trained_at')
      .in('client_id', clientIds)
      .not('notas', 'is', null)
      .order('trained_at', { ascending: false })
      .limit(30)

    if (!sessions || sessions.length === 0) {
      return { success: true, newSuggestions: 0, message: 'No hay sesiones con comentarios' }
    }

    const { data: existingSuggestions } = await supabase
      .from('rodaai_limitation_suggestions')
      .select('session_id')
      .eq('business_id', context.businessId)

    const alreadyProcessedSessionIds = new Set(
      (existingSuggestions || []).map((s) => s.session_id)
    )

    let newSuggestions = 0

    for (const session of sessions) {
      if (alreadyProcessedSessionIds.has(session.id)) continue
      if (!session.notas || !(session.notas as string).trim()) continue

      const client = clients.find((c) => c.id === session.client_id)
      if (!client) continue

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [
          {
            role: 'user',
            content: `Analiza este comentario de una sesión de entrenamiento y determina si menciona una lesión, dolor o limitación física NUEVA (no una que ya se sabía).

Comentario: "${session.notas}"

Responde SOLO en JSON, sin markdown:
{
  "hasLimitation": boolean,
  "suggestedText": "descripción breve tipo 'Tiene lesión en el tobillo'",
  "sourceQuote": "frase textual del comentario que lo indica"
}

Si no hay ninguna limitación mencionada, responde {"hasLimitation": false}`,
          },
        ],
      })

      try {
        const textContent = response.content[0]
        if (textContent.type === 'text') {
          const cleaned = textContent.text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
          const result = JSON.parse(cleaned)

          if (result.hasLimitation) {
            const { error } = await supabase.from('rodaai_limitation_suggestions').insert({
              business_id: context.businessId,
              client_id: session.client_id,
              session_id: session.id,
              suggested_text: result.suggestedText,
              suggested_type: 'fisica',
              source_quote: result.sourceQuote,
              status: 'pending',
            })
            if (!error) newSuggestions++
            else console.error('[RodaAI] Error insertando sugerencia:', error)
          }
        }
      } catch (parseError) {
        console.error(`[RodaAI] Error parsing Claude response for session ${session.id}:`, parseError)
      }
    }

    return {
      success: true,
      newSuggestions,
      summary: newSuggestions > 0
        ? `${newSuggestions} nueva(s) limitación(es) detectada(s), pendientes de tu revisión`
        : 'No se detectaron limitaciones nuevas',
    }
  },
}

export const replaceRoutineExerciseTool: RodaAITool = {
  name: 'replace_routine_exercise',
  description: 'Reemplaza un ejercicio específico en la rutina activa de un cliente por una alternativa segura del catálogo, considerando sus limitaciones registradas',
  category: 'gym',
  inputSchema: {
    type: 'object',
    properties: {
      clientName: {
        type: 'string',
        description: 'Nombre del cliente',
      },
      exerciseName: {
        type: 'string',
        description: 'Nombre exacto del ejercicio a reemplazar, tal como aparece en su rutina',
      },
    },
    required: ['clientName', 'exerciseName'],
  },
  execute: async (context: RodaAIBusinessContext, params: RodaAIToolInput) => {
    const supabase = createGymAdminClient()
    const clientName = params.clientName as string
    const exerciseName = params.exerciseName as string

    // 1. Buscar cliente
    const { data: client } = await supabase
      .from('gym_clients')
      .select('id, nombre, lesion_actual, problema_cardiovascular')
      .eq('business_id', context.businessId)
      .ilike('nombre', `%${clientName}%`)
      .maybeSingle()

    if (!client) {
      return { success: false, error: `No se encontró un cliente llamado "${clientName}"` }
    }

    // 2. Resolver limitaciones a zonas canónicas
    const limitationsText = [client.lesion_actual as string | null, client.problema_cardiovascular as string | null]
      .filter(Boolean)
      .join('. ')

    const { data: allAliases } = await supabase
      .from('zone_aliases')
      .select('zona_usuario, zona_canonica')

    const canonicalZones = new Set<string>()
    if (allAliases && limitationsText) {
      for (const alias of allAliases) {
        if (limitationsText.toLowerCase().includes((alias.zona_usuario as string).toLowerCase())) {
          canonicalZones.add(alias.zona_canonica as string)
        }
      }
    }

    // 3. Buscar rutina más reciente (activa o generada)
    const { data: routines } = await supabase
      .from('gym_routines')
      .select('id, routine_data')
      .eq('client_id', client.id as string)
      .in('estado', ['activa', 'generada'])
      .order('generated_at', { ascending: false })
      .limit(1)

    const routine = routines?.[0]
    if (!routine) {
      return { success: false, error: `${client.nombre as string} no tiene una rutina activa para modificar` }
    }

    const routineData = routine.routine_data as {
      dias: Array<{ nombre: string; dia_index: number; ejercicios: Array<Record<string, unknown>> }>
      notas_generales: string | null
    }

    // 4. Localizar el ejercicio dentro de los días
    let foundExercise: Record<string, unknown> | null = null
    let foundDiaIndex = -1
    let foundEjercicioIndex = -1

    for (let d = 0; d < routineData.dias.length; d++) {
      const ejercicios = routineData.dias[d].ejercicios
      const idx = ejercicios.findIndex(
        (e) => (e.nombre as string).toLowerCase() === exerciseName.toLowerCase()
      )
      if (idx !== -1) {
        foundExercise = ejercicios[idx]
        foundDiaIndex = d
        foundEjercicioIndex = idx
        break
      }
    }

    if (!foundExercise) {
      return {
        success: false,
        error: `No se encontró el ejercicio "${exerciseName}" en la rutina de ${client.nombre as string}`,
      }
    }

    // 5. Obtener patron y grupo_muscular del ejercicio original
    const { data: originalExercise } = await supabase
      .from('exercises')
      .select('patron, grupo_muscular, equipo')
      .eq('id', foundExercise.exercise_id as string)
      .maybeSingle()

    if (!originalExercise) {
      return { success: false, error: 'No se pudo obtener información del ejercicio original en el catálogo' }
    }

    // 6. Buscar candidatos con mismo patron + grupo_muscular
    const { data: candidates } = await supabase
      .from('exercises')
      .select('id, nombre, patron, grupo_muscular, equipo')
      .eq('patron', originalExercise.patron as string)
      .eq('grupo_muscular', originalExercise.grupo_muscular as string)
      .neq('id', foundExercise.exercise_id as string)

    if (!candidates || candidates.length === 0) {
      return {
        success: false,
        error: `No hay alternativas disponibles en el catálogo para "${exerciseName}" (mismo patrón y grupo muscular)`,
      }
    }

    // 7. Filtrar por restricciones forbidden en las zonas del cliente
    const candidateIds = candidates.map((c) => c.id as string)
    const { data: restrictions } = await supabase
      .from('exercise_restrictions')
      .select('exercise_id, zona_corporal, severidad')
      .in('exercise_id', candidateIds)

    const forbiddenIds = new Set(
      (restrictions || [])
        .filter((r) => r.severidad === 'forbidden' && canonicalZones.has(r.zona_corporal as string))
        .map((r) => r.exercise_id as string)
    )

    const safeCandidates = candidates.filter((c) => !forbiddenIds.has(c.id as string))

    if (safeCandidates.length === 0) {
      return {
        success: false,
        error: `Todas las alternativas disponibles para "${exerciseName}" están contraindicadas para las limitaciones de ${client.nombre as string}. Se requiere revisión manual.`,
      }
    }

    // 8. Preferir mismo equipo
    const sameEquipment = safeCandidates.filter((c) => c.equipo === originalExercise.equipo)
    const chosen = (sameEquipment.length > 0 ? sameEquipment : safeCandidates)[0]

    // 9. Reemplazar en memoria
    const updatedDias = routineData.dias.map((dia, dIdx) => {
      if (dIdx !== foundDiaIndex) return dia
      return {
        ...dia,
        ejercicios: dia.ejercicios.map((ej, eIdx) => {
          if (eIdx !== foundEjercicioIndex) return ej
          return {
            exercise_id: chosen.id as string,
            nombre: chosen.nombre as string,
            series: ej.series,
            repeticiones: ej.repeticiones,
            descanso_seg: ej.descanso_seg,
            gif_url: null,
            peso_objetivo_kg: null,
            nota: `Reemplazado automáticamente por RodaAI: ${exerciseName} → ${chosen.nombre as string} (limitación registrada)`,
          }
        }),
      }
    })

    // 10. Persistir: UPDATE routine_data + DELETE/INSERT gym_routine_exercises
    const { error: updateError } = await supabase
      .from('gym_routines')
      .update({ routine_data: { dias: updatedDias, notas_generales: routineData.notas_generales } })
      .eq('id', routine.id as string)

    if (updateError) {
      return { success: false, error: `Error al guardar la rutina: ${updateError.message}` }
    }

    await supabase.from('gym_routine_exercises').delete().eq('routine_id', routine.id as string)

    const flatExercises = updatedDias.flatMap((dia) =>
      dia.ejercicios.map((ej, orden) => ({
        routine_id: routine.id as string,
        exercise_id: ej.exercise_id as string,
        dia: Math.min(Math.max(dia.dia_index + 1, 1), 7),
        series: ej.series as number,
        reps_o_segundos: parseReps(ej.repeticiones as string),
        tempo: null,
        orden,
        notas_adaptacion: (ej.nota as string | null) ?? null,
      }))
    )

    const { error: insertError } = await supabase.from('gym_routine_exercises').insert(flatExercises)

    if (insertError) {
      return { success: false, error: `Ejercicio reemplazado en routine_data pero falló la tabla plana: ${insertError.message}` }
    }

    return {
      success: true,
      replaced: {
        from: exerciseName,
        to: chosen.nombre as string,
        day: routineData.dias[foundDiaIndex].nombre,
      },
      message: `Se reemplazó "${exerciseName}" por "${chosen.nombre as string}" en ${routineData.dias[foundDiaIndex].nombre}, considerando las limitaciones de ${client.nombre as string}.`,
    }
  },
}

export const GYM_TOOLS: RodaAITool[] = [
  getClientProfileTool,
  getActiveRoutinesTool,
  getWorkoutHistoryTool,
  searchClientsTool,
  getClientAlertsTool,
  analyzeInjuryNotesTool,
  detectRoutineConflictsTool,
  detectLimitationFromSessionsTool,
  replaceRoutineExerciseTool,
];
