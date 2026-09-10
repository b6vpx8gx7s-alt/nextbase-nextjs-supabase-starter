import { createGymAdminClient } from '@/app/api/gym/_helpers';
import { type RodaAIBusinessContext } from './rodaai-business';
import { type RodaAITool, type RodaAIToolInput } from './rodaai-tools';

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

export const GYM_TOOLS: RodaAITool[] = [
  getClientProfileTool,
  getActiveRoutinesTool,
  getWorkoutHistoryTool,
  searchClientsTool,
  getClientAlertsTool,
];
