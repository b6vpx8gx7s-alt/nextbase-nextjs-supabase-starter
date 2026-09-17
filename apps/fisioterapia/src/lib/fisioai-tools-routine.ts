import { createFisioAdminClient } from '@/app/api/fisio/_helpers';
import { type FisioAIBusinessContext } from './fisioai-business';
import { type FisioAITool, type FisioAIToolInput } from './fisioai-tools';

export const suggestExerciseReplacementTool: FisioAITool = {
  name: 'suggest_exercise_replacement',
  description:
    'Busca alternativas seguras para reemplazar un ejercicio de la rutina de un paciente por su patología o dolor, y las presenta como opciones. NO ejecuta el reemplazo — solo sugiere.',
  inputSchema: {
    type: 'object',
    properties: {
      clientName: { type: 'string', description: 'Nombre del paciente' },
      clientId: { type: 'string', description: 'UUID exacto del paciente (usar si hubo ambigüedad previa en el nombre)' },
      exerciseName: {
        type: 'string',
        description: 'Nombre exacto del ejercicio a reemplazar, tal como aparece en su rutina',
      },
    },
    required: ['clientName', 'exerciseName'],
  },
  execute: async (context: FisioAIBusinessContext, params: FisioAIToolInput) => {
    const supabase = createFisioAdminClient();
    const clientName = params.clientName as string;
    const clientId = params.clientId as string | undefined;
    const exerciseName = params.exerciseName as string;

    // 1. Buscar paciente — soporta búsqueda por ID exacto o por nombre
    let client: { id: string; nombre: string } | null = null;

    if (clientId) {
      const { data } = await supabase
        .from('physio_clients')
        .select('id, nombre')
        .eq('id', clientId)
        .eq('business_id', context.businessId)
        .maybeSingle();
      client = data;
      if (!client) return { success: false, error: `No se encontró el paciente con ID "${clientId}"` };
    } else {
      const { data: matchingClients, error: clientSearchError } = await supabase
        .from('physio_clients')
        .select('id, nombre')
        .eq('business_id', context.businessId)
        .ilike('nombre', `%${clientName}%`)
        .limit(5);

      if (clientSearchError) {
        return { success: false, error: `Error buscando paciente: ${clientSearchError.message}` };
      }
      if (!matchingClients || matchingClients.length === 0) {
        return { success: false, error: `No se encontró un paciente llamado "${clientName}"` };
      }
      if (matchingClients.length > 1) {
        return {
          success: false,
          needsDisambiguation: true,
          options: matchingClients.map((c) => ({ id: c.id, nombre: c.nombre })),
          error: `Hay ${matchingClients.length} pacientes que coinciden con "${clientName}": ${matchingClients.map((c) => c.nombre).join(', ')}. Pídele al usuario el ID exacto o un nombre más específico, y vuelve a llamar a esta herramienta usando ese ID en el campo clientId.`,
        };
      }
      client = matchingClients[0];
    }

    // 2. Resolver zonas canónicas desde pathologies y pain_map
    // (ya vienen normalizadas — no necesitamos zone_aliases)
    const [pathRes, painRes] = await Promise.all([
      supabase
        .from('pathologies')
        .select('zona_corporal')
        .eq('client_id', client.id as string),
      supabase
        .from('pain_map')
        .select('zona_corporal')
        .eq('client_id', client.id as string),
    ]);

    const canonicalZones = new Set<string>();
    for (const p of pathRes.data ?? []) canonicalZones.add((p.zona_corporal as string).toLowerCase());
    for (const p of painRes.data ?? []) canonicalZones.add((p.zona_corporal as string).toLowerCase());

    // 3. Rutina más reciente activa o generada
    const { data: routines } = await supabase
      .from('physio_routines')
      .select('id, routine_data')
      .eq('client_id', client.id as string)
      .in('estado', ['activa', 'generada'])
      .order('generated_at', { ascending: false })
      .limit(1);

    const routine = routines?.[0];
    if (!routine) {
      return {
        success: false,
        error: `${client.nombre as string} no tiene una rutina activa para modificar`,
      };
    }

    const routineData = routine.routine_data as {
      dias: Array<{ nombre: string; dia_index: number; ejercicios: Array<Record<string, unknown>> }>;
      notas_generales: string | null;
    };

    // 4. Localizar el ejercicio dentro de los días
    let foundExercise: Record<string, unknown> | null = null;
    let foundDiaIndex = -1;

    for (let d = 0; d < routineData.dias.length; d++) {
      const idx = routineData.dias[d].ejercicios.findIndex(
        (e) => (e.nombre as string).toLowerCase() === exerciseName.toLowerCase()
      );
      if (idx !== -1) {
        foundExercise = routineData.dias[d].ejercicios[idx];
        foundDiaIndex = d;
        break;
      }
    }

    if (!foundExercise) {
      return {
        success: false,
        error: `No se encontró el ejercicio "${exerciseName}" en la rutina de ${client.nombre as string}`,
      };
    }

    // 5. Obtener patron, grupo_muscular y equipo del ejercicio original
    const { data: originalExercise } = await supabase
      .from('exercises')
      .select('patron, grupo_muscular, equipo')
      .eq('id', foundExercise.exercise_id as string)
      .maybeSingle();

    if (!originalExercise) {
      return { success: false, error: 'No se pudo obtener información del ejercicio original en el catálogo' };
    }

    // 6. Verificar que el original tiene restricciones en las zonas del paciente
    const { data: originalRestrictions } = await supabase
      .from('exercise_restrictions')
      .select('zona_corporal, severidad')
      .eq('exercise_id', foundExercise.exercise_id as string);

    const originalRisksClientZones = (originalRestrictions ?? []).some((r) =>
      canonicalZones.has((r.zona_corporal as string).toLowerCase())
    );

    if (!originalRisksClientZones) {
      return {
        success: false,
        needsReplacement: false,
        message: `"${exerciseName}" no tiene ninguna restricción registrada que coincida con las condiciones actuales de ${client.nombre as string}. No hay evidencia de que sea un riesgo — no se sugiere reemplazo. Si tienes otra razón para cambiarlo, dímelo explícitamente.`,
      };
    }

    // 7. Buscar candidatos con mismo patron + grupo_muscular, excluir estiramientos pasivos
    const { data: candidates } = await supabase
      .from('exercises')
      .select('id, nombre, patron, grupo_muscular, equipo, gif_url')
      .eq('patron', originalExercise.patron as string)
      .eq('grupo_muscular', originalExercise.grupo_muscular as string)
      .in('context', ['fisioterapia', 'ambos'])
      .neq('id', foundExercise.exercise_id as string)
      .not('nombre', 'ilike', '%estirami%')
      .not('nombre', 'ilike', '%stretch%');

    if (!candidates || candidates.length === 0) {
      return {
        success: false,
        error: `No hay alternativas disponibles en el catálogo para "${exerciseName}" (mismo patrón y grupo muscular)`,
      };
    }

    // 8. Filtrar por forbidden en zonas del paciente; excluir sin evaluación si hay zonas
    const candidateIds = candidates.map((c) => c.id as string);
    const { data: restrictions } = await supabase
      .from('exercise_restrictions')
      .select('exercise_id, zona_corporal, severidad')
      .in('exercise_id', candidateIds);

    const forbiddenIds = new Set(
      (restrictions ?? [])
        .filter(
          (r) =>
            r.severidad === 'forbidden' &&
            canonicalZones.has((r.zona_corporal as string).toLowerCase())
        )
        .map((r) => r.exercise_id as string)
    );

    const evaluatedIds = new Set((restrictions ?? []).map((r) => r.exercise_id as string));

    const safeCandidates = candidates.filter((c) => {
      if (forbiddenIds.has(c.id as string)) return false;
      if (canonicalZones.size > 0 && !evaluatedIds.has(c.id as string)) return false;
      return true;
    });

    if (safeCandidates.length === 0 && canonicalZones.size > 0) {
      return {
        success: false,
        error: `No hay ejercicios evaluados explícitamente como seguros para las condiciones de ${client.nombre as string} (patrón: ${originalExercise.patron as string}, grupo muscular: ${originalExercise.grupo_muscular as string}). Ningún candidato tiene restricciones registradas que confirmen si es seguro — se requiere revisión manual del fisioterapeuta.`,
      };
    }

    if (safeCandidates.length === 0) {
      return {
        success: false,
        error: `Todas las alternativas para "${exerciseName}" están contraindicadas para las condiciones de ${client.nombre as string}. Se requiere revisión manual.`,
      };
    }

    // 9. Hasta 3 candidatos, preferir mismo equipo primero
    const sameEquipment = safeCandidates.filter((c) => c.equipo === originalExercise.equipo);
    const ordered = [
      ...sameEquipment,
      ...safeCandidates.filter((c) => !sameEquipment.includes(c)),
    ];
    const options = ordered.slice(0, 3);

    return {
      success: true,
      needsUserChoice: true,
      originalExercise: exerciseName,
      clientName: client.nombre as string,
      day: routineData.dias[foundDiaIndex].nombre,
      options: options.map((c) => ({
        exerciseId: c.id as string,
        nombre: c.nombre as string,
        equipo: c.equipo as string,
      })),
      message: `Encontré ${options.length} alternativa(s) segura(s) para "${exerciseName}". Pregúntale al usuario cuál prefiere antes de aplicar el cambio.`,
    };
  },
};

export const confirmExerciseReplacementTool: FisioAITool = {
  name: 'confirm_exercise_replacement',
  description:
    'Ejecuta un reemplazo de ejercicio YA ELEGIDO por el usuario. Solo usar después de que el usuario confirmó explícitamente cuál alternativa prefiere de una lista ya presentada por suggest_exercise_replacement.',
  inputSchema: {
    type: 'object',
    properties: {
      clientName: { type: 'string', description: 'Nombre del paciente' },
      clientId: { type: 'string', description: 'UUID exacto del paciente (usar si hubo ambigüedad previa en el nombre)' },
      exerciseName: {
        type: 'string',
        description: 'Nombre exacto del ejercicio original a reemplazar',
      },
      chosenExerciseId: {
        type: 'string',
        description: 'exercise_id de la alternativa elegida por el usuario',
      },
    },
    required: ['clientName', 'exerciseName', 'chosenExerciseId'],
  },
  execute: async (context: FisioAIBusinessContext, params: FisioAIToolInput) => {
    const supabase = createFisioAdminClient();
    const clientName = params.clientName as string;
    const clientId = params.clientId as string | undefined;
    const exerciseName = params.exerciseName as string;
    const chosenExerciseId = params.chosenExerciseId as string;

    let client: { id: string; nombre: string } | null = null;

    if (clientId) {
      const { data } = await supabase
        .from('physio_clients')
        .select('id, nombre')
        .eq('id', clientId)
        .eq('business_id', context.businessId)
        .maybeSingle();
      client = data;
      if (!client) return { success: false, error: `No se encontró el paciente con ID "${clientId}"` };
    } else {
      const { data: matchingClients, error: clientSearchError } = await supabase
        .from('physio_clients')
        .select('id, nombre')
        .eq('business_id', context.businessId)
        .ilike('nombre', `%${clientName}%`)
        .limit(5);

      if (clientSearchError) {
        return { success: false, error: `Error buscando paciente: ${clientSearchError.message}` };
      }
      if (!matchingClients || matchingClients.length === 0) {
        return { success: false, error: `No se encontró un paciente llamado "${clientName}"` };
      }
      if (matchingClients.length > 1) {
        return {
          success: false,
          needsDisambiguation: true,
          options: matchingClients.map((c) => ({ id: c.id, nombre: c.nombre })),
          error: `Hay ${matchingClients.length} pacientes que coinciden con "${clientName}": ${matchingClients.map((c) => c.nombre).join(', ')}. Pídele al usuario el ID exacto o un nombre más específico, y vuelve a llamar a esta herramienta usando ese ID en el campo clientId.`,
        };
      }
      client = matchingClients[0];
    }

    const { data: chosenExercise } = await supabase
      .from('exercises')
      .select('id, nombre, gif_url')
      .eq('id', chosenExerciseId)
      .maybeSingle();

    if (!chosenExercise) {
      return { success: false, error: 'El ejercicio elegido no existe en el catálogo' };
    }

    const { data: routines } = await supabase
      .from('physio_routines')
      .select('id, routine_data')
      .eq('client_id', client.id as string)
      .in('estado', ['activa', 'generada'])
      .order('generated_at', { ascending: false })
      .limit(1);

    const routine = routines?.[0];
    if (!routine) {
      return {
        success: false,
        error: `${client.nombre as string} no tiene una rutina activa para modificar`,
      };
    }

    const routineData = routine.routine_data as {
      dias: Array<{ nombre: string; dia_index: number; ejercicios: Array<Record<string, unknown>> }>;
      notas_generales: string | null;
    };

    let foundDiaIndex = -1;
    let foundEjercicioIndex = -1;

    for (let d = 0; d < routineData.dias.length; d++) {
      const idx = routineData.dias[d].ejercicios.findIndex(
        (e) => (e.nombre as string).toLowerCase() === exerciseName.toLowerCase()
      );
      if (idx !== -1) {
        foundDiaIndex = d;
        foundEjercicioIndex = idx;
        break;
      }
    }

    if (foundDiaIndex === -1) {
      return {
        success: false,
        error: `No se encontró "${exerciseName}" en la rutina de ${client.nombre as string}`,
      };
    }

    const diaData = routineData.dias[foundDiaIndex];
    const oldEjercicio = diaData.ejercicios[foundEjercicioIndex];

    const { error: insertError } = await supabase
      .from('physio_routine_pending_changes')
      .insert({
        routine_id: routine.id as string,
        business_id: context.businessId,
        dia_index: diaData.dia_index as number,
        old_exercise_id: oldEjercicio.exercise_id as string,
        old_exercise_nombre: exerciseName,
        new_exercise_id: chosenExercise.id as string,
        new_exercise_nombre: chosenExercise.nombre as string,
        new_gif_url: (chosenExercise.gif_url as string | null) ?? null,
        motivo: null,
        status: 'pending',
      });

    if (insertError) {
      return { success: false, error: `Error al guardar la propuesta: ${insertError.message}` };
    }

    return {
      success: true,
      message: `Propuesta guardada: "${exerciseName}" → "${chosenExercise.nombre as string}" para ${client.nombre as string}. El fisioterapeuta debe confirmar el cambio en la vista de la rutina antes de que se aplique.`,
    };
  },
};
