import { createAdminClient } from '@/supabase-clients/admin';
import { type NutriAIBusinessContext } from './nutrai-business';
import { type NutriAITool, type NutriAIToolInput } from './nutrai-tools';

export const searchClientsTool: NutriAITool = {
  name: 'search_clients',
  description:
    'Busca clientes del negocio por nombre (fragmento parcial) o lista los primeros 5. Retorna id, nombre, teléfono, email y cantidad de planes registrados.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Nombre o fragmento del nombre a buscar. Vacío para listar los 5 primeros.',
      },
    },
    required: [],
  },
  execute: async (context: NutriAIBusinessContext, params: NutriAIToolInput) => {
    const supabase = createAdminClient();
    const searchName = ((params.name as string | undefined) ?? '').trim();

    let query = supabase
      .from('nutrition_clients')
      .select('id, nombre, telefono, email')
      .eq('business_id', context.businessId)
      .order('nombre');

    if (searchName) {
      query = query.ilike('nombre', `%${searchName}%`);
    }

    const { data: clients, error } = await query.limit(5);
    if (error) throw error;

    if (!clients || clients.length === 0) {
      return { success: true, count: 0, clients: [] };
    }

    // Count plans per client via client_id
    const clientIds = (clients as Array<{ id: string }>).map((c) => c.id);
    const { data: planRows } = await supabase
      .from('nutrition_plans')
      .select('client_id')
      .eq('business_id', context.businessId)
      .in('client_id', clientIds);

    const countByClient = new Map<string, number>();
    for (const row of planRows ?? []) {
      const cid = row.client_id as string;
      countByClient.set(cid, (countByClient.get(cid) ?? 0) + 1);
    }

    const result = (clients as Array<Record<string, unknown>>).map((c) => ({
      id: c.id,
      nombre: c.nombre,
      telefono: c.telefono ?? null,
      email: c.email ?? null,
      planCount: countByClient.get(c.id as string) ?? 0,
    }));

    return {
      success: true,
      count: result.length,
      clients: result,
      hint: 'Usa el id del cliente con get_client_profile o get_active_plan para más detalle.',
    };
  },
};

export const getClientProfileTool: NutriAITool = {
  name: 'get_client_profile',
  description:
    'Obtiene el historial completo de planes de un cliente con datos clínicos (patient_info). Acepta clientId (UUID, preferido tras una búsqueda) o clientName (para búsqueda con posible desambiguación).',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: {
        type: 'string',
        description: 'UUID del cliente (nutrition_clients.id). Usar cuando ya se conoce el id exacto.',
      },
      clientName: {
        type: 'string',
        description: 'Nombre o fragmento del nombre. Usar solo si no se tiene el clientId.',
      },
    },
    required: [],
  },
  execute: async (context: NutriAIBusinessContext, params: NutriAIToolInput) => {
    const supabase = createAdminClient();
    let clientId = ((params.clientId as string | undefined) ?? '').trim() || undefined;

    if (!clientId) {
      const clientName = ((params.clientName as string | undefined) ?? '').trim();
      if (!clientName) throw new Error('Se requiere clientId o clientName');

      // Never .maybeSingle() — queremos la lista completa para detectar ambigüedad
      const { data: matches, error: searchErr } = await supabase
        .from('nutrition_clients')
        .select('id, nombre')
        .eq('business_id', context.businessId)
        .ilike('nombre', `%${clientName}%`)
        .limit(5);

      if (searchErr) throw searchErr;

      if (!matches || matches.length === 0) {
        return {
          success: false,
          error: `No se encontró ningún cliente con nombre similar a "${clientName}"`,
        };
      }

      if (matches.length > 1) {
        return {
          success: false,
          needsDisambiguation: true,
          matches: (matches as Array<{ id: string; nombre: string }>).map((m) => ({
            clientId: m.id,
            nombre: m.nombre,
          })),
          message: `Hay ${matches.length} clientes que coinciden con "${clientName}". ¿A cuál te refieres? Usa el clientId exacto para continuar.`,
        };
      }

      clientId = (matches[0] as { id: string }).id;
    }

    // Fetch client data + all plans with patient_info
    const [clientRes, plansRes] = await Promise.all([
      supabase
        .from('nutrition_clients')
        .select('id, nombre, telefono, email, documento, created_at')
        .eq('id', clientId)
        .eq('business_id', context.businessId),
      supabase
        .from('nutrition_plans')
        .select('id, duration_days, notes, created_at, patient_info(*)')
        .eq('client_id', clientId)
        .eq('business_id', context.businessId)
        .order('created_at', { ascending: false }),
    ]);

    if (clientRes.error) throw clientRes.error;
    if (!clientRes.data || clientRes.data.length === 0) {
      return { success: false, error: 'Cliente no encontrado o sin acceso' };
    }

    const client = (clientRes.data as Array<Record<string, unknown>>)[0];
    const plans = ((plansRes.data ?? []) as Array<Record<string, unknown>>).map((p) => {
      const pi = p.patient_info;
      return {
        ...p,
        patient_info: Array.isArray(pi) ? (pi[0] ?? null) : (pi ?? null),
      };
    });

    return {
      success: true,
      client,
      planCount: plans.length,
      plans,
    };
  },
};

export const getActivePlanTool: NutriAITool = {
  name: 'get_active_plan',
  description:
    'Obtiene el plan nutricional más reciente de un cliente con sus comidas agrupadas por día. Requiere clientId (UUID de nutrition_clients).',
  inputSchema: {
    type: 'object',
    properties: {
      clientId: {
        type: 'string',
        description: 'UUID del cliente (nutrition_clients.id).',
      },
    },
    required: ['clientId'],
  },
  execute: async (context: NutriAIBusinessContext, params: NutriAIToolInput) => {
    const supabase = createAdminClient();
    const clientId = ((params.clientId as string) ?? '').trim();
    if (!clientId) throw new Error('clientId es requerido');

    // Fetch most recent plan + client name in parallel
    const [planRes, clientRes] = await Promise.all([
      supabase
        .from('nutrition_plans')
        .select('id, duration_days, notes, created_at, patient_info(*)')
        .eq('client_id', clientId)
        .eq('business_id', context.businessId)
        .order('created_at', { ascending: false })
        .limit(1),
      supabase
        .from('nutrition_clients')
        .select('nombre, telefono')
        .eq('id', clientId)
        .eq('business_id', context.businessId),
    ]);

    if (planRes.error) throw planRes.error;
    if (!planRes.data || planRes.data.length === 0) {
      return { success: false, error: 'Este cliente no tiene planes registrados' };
    }

    const plan = (planRes.data as Array<Record<string, unknown>>)[0];
    const planId = plan.id as string;
    const piRaw = plan.patient_info;
    const patientInfo = Array.isArray(piRaw) ? (piRaw[0] ?? null) : (piRaw ?? null);

    const clientData =
      clientRes.data && (clientRes.data as Array<Record<string, unknown>>).length > 0
        ? (clientRes.data as Array<Record<string, unknown>>)[0]
        : null;

    // Fetch meals for the plan
    const { data: mealsData, error: mealsErr } = await supabase
      .from('nutrition_plan_meals')
      .select('day, meal_type, foods, macros, notes')
      .eq('plan_id', planId)
      .order('day')
      .order('meal_type');

    if (mealsErr) throw mealsErr;

    type MealEntry = { meal_type: string; foods: unknown; macros: unknown; notes: unknown };
    const mealsByDay: Record<number, MealEntry[]> = {};
    for (const meal of mealsData ?? []) {
      const day = meal.day as number;
      if (!mealsByDay[day]) mealsByDay[day] = [];
      mealsByDay[day].push({
        meal_type: meal.meal_type as string,
        foods: meal.foods,
        macros: meal.macros,
        notes: meal.notes,
      });
    }

    return {
      success: true,
      plan: {
        id: planId,
        clientId,
        clientName: clientData?.nombre ?? null,
        clientPhone: clientData?.telefono ?? null,
        durationDays: plan.duration_days,
        notes: plan.notes,
        createdAt: plan.created_at,
        patientInfo,
        daysWithMeals: Object.keys(mealsByDay).length,
        mealsPerDay: Object.fromEntries(
          Object.entries(mealsByDay).map(([day, meals]) => [day, meals.length])
        ),
        meals: mealsByDay,
      },
    };
  },
};

export const getClientAlertsTool: NutriAITool = {
  name: 'get_client_alerts',
  description:
    'Genera alertas sobre clientes del negocio: sin ningún plan, plan desactualizado (>30 días) y patient_info clínico incompleto.',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (context: NutriAIBusinessContext, _params: NutriAIToolInput) => {
    const supabase = createAdminClient();

    const { data: allClients, error: clientsErr } = await supabase
      .from('nutrition_clients')
      .select('id, nombre')
      .eq('business_id', context.businessId);

    if (clientsErr) throw clientsErr;

    if (!allClients || allClients.length === 0) {
      return {
        success: true,
        totalClients: 0,
        alerts: {
          noPlan: { count: 0, clients: [], description: 'Clientes sin ningún plan registrado' },
          stalePlan: { count: 0, clients: [], description: 'Clientes cuyo plan más reciente tiene más de 30 días' },
          incompleteInfo: { count: 0, clients: [], description: 'Clientes con patient_info incompleto' },
        },
        totalAlerts: 0,
      };
    }

    const clientIds = (allClients as Array<{ id: string; nombre: string }>).map((c) => c.id);
    const clientNameById = new Map<string, string>(
      (allClients as Array<{ id: string; nombre: string }>).map((c) => [c.id, c.nombre])
    );

    // All plans for these clients, ordered desc so first occurrence per client is the most recent
    const { data: allPlans, error: plansErr } = await supabase
      .from('nutrition_plans')
      .select('client_id, created_at, patient_info(objective, restrictions, allergies, medical_conditions)')
      .eq('business_id', context.businessId)
      .in('client_id', clientIds)
      .order('created_at', { ascending: false });

    if (plansErr) throw plansErr;

    type PlanEntry = { createdAt: string; patientInfo: Record<string, unknown> | null };
    const latestPlanByClient = new Map<string, PlanEntry>();

    for (const plan of allPlans ?? []) {
      const cid = plan.client_id as string;
      if (!latestPlanByClient.has(cid)) {
        const piRaw = plan.patient_info;
        const pi =
          Array.isArray(piRaw)
            ? (piRaw[0] ?? null)
            : ((piRaw as Record<string, unknown> | null) ?? null);
        latestPlanByClient.set(cid, { createdAt: plan.created_at as string, patientInfo: pi });
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const noPlanClients: string[] = [];
    const stalePlanClients: string[] = [];
    const incompleteInfoClients: string[] = [];

    for (const clientId of clientIds) {
      const nombre = clientNameById.get(clientId) ?? clientId;
      const latestPlan = latestPlanByClient.get(clientId);

      if (!latestPlan) {
        noPlanClients.push(nombre);
        continue;
      }

      if (new Date(latestPlan.createdAt) < thirtyDaysAgo) {
        stalePlanClients.push(nombre);
      }

      const pi = latestPlan.patientInfo;
      const missingObjective = !pi?.objective;
      const missingClinical =
        (!pi?.restrictions || (pi.restrictions as unknown[]).length === 0) &&
        !pi?.allergies &&
        !pi?.medical_conditions;

      if (!pi || missingObjective || missingClinical) {
        incompleteInfoClients.push(nombre);
      }
    }

    return {
      success: true,
      totalClients: allClients.length,
      alerts: {
        noPlan: {
          count: noPlanClients.length,
          clients: noPlanClients,
          description: 'Clientes sin ningún plan registrado',
        },
        stalePlan: {
          count: stalePlanClients.length,
          clients: stalePlanClients,
          description: 'Clientes cuyo plan más reciente tiene más de 30 días',
        },
        incompleteInfo: {
          count: incompleteInfoClients.length,
          clients: incompleteInfoClients,
          description: 'Clientes con patient_info incompleto (falta objetivo o datos clínicos)',
        },
      },
      totalAlerts: noPlanClients.length + stalePlanClients.length + incompleteInfoClients.length,
    };
  },
};
