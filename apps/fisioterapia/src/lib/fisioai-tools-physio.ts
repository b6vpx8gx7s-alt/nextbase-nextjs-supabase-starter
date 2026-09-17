import { createFisioAdminClient } from '@/app/api/fisio/_helpers';
import { type FisioAIBusinessContext } from './fisioai-business';
import { type FisioAITool, type FisioAIToolInput } from './fisioai-tools';

function isTherapist(context: FisioAIBusinessContext) {
  return context.userRole === 'trainer' || context.userRole === 'employee';
}

async function assertClientAccess(context: FisioAIBusinessContext, clientId: string) {
  if (isTherapist(context)) {
    const supabase = createFisioAdminClient();
    const { data: client } = await supabase
      .from('physio_clients')
      .select('id')
      .eq('id', clientId)
      .eq('business_id', context.businessId)
      .maybeSingle();
    if (!client) throw new Error(`Unauthorized: Cannot access client ${clientId}`);
  } else if (context.clientIdentifier !== clientId) {
    throw new Error('Unauthorized: Cannot access other patients');
  }
}

export const getClientProfileTool: FisioAITool = {
  name: 'get_client_profile',
  description:
    'Obtiene el perfil clínico completo del paciente: datos básicos, patologías diagnosticadas y mapa de dolor activo',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'UUID del paciente (physio_client.id)' },
    },
    required: ['clientId'],
  },
  execute: async (context: FisioAIBusinessContext, params: FisioAIToolInput) => {
    const clientId = params.clientId as string;
    await assertClientAccess(context, clientId);

    const supabase = createFisioAdminClient();

    const [profileRes, pathRes, painRes] = await Promise.all([
      supabase
        .from('physio_clients')
        .select('id, nombre, email, telefono, fecha_nacimiento, nivel_fisico, objetivo, dias_disponibles, notas')
        .eq('id', clientId)
        .single(),
      supabase
        .from('pathologies')
        .select('id, nombre, zona_corporal, fecha_diagnostico, notas')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }),
      supabase
        .from('pain_map')
        .select('id, zona_corporal, mecanica, nivel')
        .eq('client_id', clientId)
        .order('nivel', { ascending: false }),
    ]);

    if (profileRes.error) throw profileRes.error;
    const p = profileRes.data;

    return {
      success: true,
      profile: {
        id: p.id,
        nombre: p.nombre,
        email: p.email,
        telefono: p.telefono,
        edad: p.fecha_nacimiento
          ? new Date().getFullYear() - new Date(p.fecha_nacimiento as string).getFullYear()
          : null,
        nivel_fisico: p.nivel_fisico,
        objetivo: p.objetivo,
        dias_disponibles: p.dias_disponibles,
        notas: p.notas,
        pathologies: pathRes.data ?? [],
        pain_map: painRes.data ?? [],
      },
    };
  },
};

export const getActiveRoutinesTool: FisioAITool = {
  name: 'get_active_routines',
  description: 'Obtiene la rutina terapéutica vigente del paciente (más reciente generada o activa)',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: { type: 'string', description: 'UUID del paciente' },
    },
    required: ['clientId'],
  },
  execute: async (context: FisioAIBusinessContext, params: FisioAIToolInput) => {
    const clientId = params.clientId as string;
    await assertClientAccess(context, clientId);

    const supabase = createFisioAdminClient();

    const { data: routine, error } = await supabase
      .from('physio_routines')
      .select('id, semana, year, routine_data, estado, generated_at, created_at')
      .eq('client_id', clientId)
      .in('estado', ['activa', 'generada'])
      .order('generated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!routine) return { success: true, routine: null, message: 'El paciente no tiene rutina activa' };

    const dias = (routine.routine_data as { dias?: unknown[] })?.dias ?? [];
    const diasResumen = (dias as Array<{ nombre?: string; ejercicios?: unknown[] }>).map((d) => ({
      nombre: d.nombre ?? '',
      ejercicios: d.ejercicios?.length ?? 0,
    }));

    return {
      success: true,
      routine: {
        id: routine.id,
        semana: routine.semana,
        year: routine.year,
        estado: routine.estado,
        generada: routine.generated_at,
        dias_count: dias.length,
        dias: diasResumen,
        notas_generales: (routine.routine_data as { notas_generales?: string })?.notas_generales ?? null,
      },
    };
  },
};

export const searchClientsTool: FisioAITool = {
  name: 'search_clients',
  description: 'Busca pacientes por nombre o retorna todos los del negocio si la búsqueda está vacía',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Nombre del paciente a buscar (vacío para listar todos)',
      },
    },
    required: ['name'],
  },
  execute: async (context: FisioAIBusinessContext, params: FisioAIToolInput) => {
    if (!isTherapist(context)) {
      throw new Error('Unauthorized: solo el terapeuta puede buscar pacientes');
    }

    const supabase = createFisioAdminClient();
    const searchName = params.name as string;

    let query = supabase
      .from('physio_clients')
      .select('id, nombre, objetivo, nivel_fisico')
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

export const getClientAlertsTool: FisioAITool = {
  name: 'get_client_alerts',
  description:
    'Obtiene pacientes que requieren atención: sin rutina activa, rutina desactualizada (>14 días) o sin medición clínica reciente (>30 días)',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (context: FisioAIBusinessContext, _params: FisioAIToolInput) => {
    if (!isTherapist(context)) {
      throw new Error('Unauthorized: solo el terapeuta puede ver alertas del negocio');
    }

    const supabase = createFisioAdminClient();

    const { data: allClients } = await supabase
      .from('physio_clients')
      .select('id, nombre')
      .eq('business_id', context.businessId);

    const clientIds = (allClients ?? []).map((c) => c.id as string);
    if (clientIds.length === 0) {
      return {
        success: true,
        alerts: {
          noRoutine: { count: 0, clients: [], description: 'Pacientes sin rutina vigente' },
          staleRoutine: { count: 0, clients: [], description: 'Pacientes con rutina desactualizada (>14 días)' },
          noMeasurement: { count: 0, clients: [], description: 'Pacientes sin medición clínica reciente (>30 días)' },
        },
        totalAlerts: 0,
      };
    }

    // Rutinas activas o generadas por paciente (más reciente)
    const { data: latestRoutines } = await supabase
      .from('physio_routines')
      .select('client_id, estado, generated_at')
      .eq('business_id', context.businessId)
      .in('estado', ['activa', 'generada'])
      .order('generated_at', { ascending: false });

    const routineByClient = new Map<string, { estado: string; generated_at: string }>();
    for (const r of latestRoutines ?? []) {
      if (!routineByClient.has(r.client_id as string)) {
        routineByClient.set(r.client_id as string, {
          estado: r.estado as string,
          generated_at: r.generated_at as string,
        });
      }
    }

    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const noRoutineClients = (allClients ?? []).filter((c) => !routineByClient.has(c.id as string));
    const staleRoutineClients = (allClients ?? []).filter((c) => {
      const r = routineByClient.get(c.id as string);
      if (!r) return false;
      return new Date(r.generated_at) < fourteenDaysAgo;
    });

    // Mediciones clínicas recientes (últimos 30 días)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoDate = thirtyDaysAgo.toISOString().split('T')[0];

    const { data: recentMeasurements } = await supabase
      .from('patient_measurements')
      .select('client_id')
      .eq('business_id', context.businessId)
      .gte('measured_at', thirtyDaysAgoDate);

    const withRecentMeasurement = new Set(
      (recentMeasurements ?? []).map((m) => m.client_id as string)
    );

    const noMeasurementClients = (allClients ?? []).filter(
      (c) => !withRecentMeasurement.has(c.id as string)
    );

    return {
      success: true,
      alerts: {
        noRoutine: {
          count: noRoutineClients.length,
          clients: noRoutineClients,
          description: 'Pacientes sin rutina vigente',
        },
        staleRoutine: {
          count: staleRoutineClients.length,
          clients: staleRoutineClients,
          description: 'Pacientes con rutina desactualizada (más de 14 días)',
        },
        noMeasurement: {
          count: noMeasurementClients.length,
          clients: noMeasurementClients,
          description: 'Pacientes sin medición clínica en los últimos 30 días',
        },
      },
      totalAlerts: noRoutineClients.length + staleRoutineClients.length + noMeasurementClients.length,
    };
  },
};
