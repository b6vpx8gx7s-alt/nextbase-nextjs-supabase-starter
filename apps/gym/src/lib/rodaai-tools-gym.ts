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

export const GYM_TOOLS: RodaAITool[] = [
  getClientProfileTool,
  getActiveRoutinesTool,
  getWorkoutHistoryTool,
];
