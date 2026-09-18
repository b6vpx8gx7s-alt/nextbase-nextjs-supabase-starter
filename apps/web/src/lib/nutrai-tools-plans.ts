import { createAdminClient } from '@/supabase-clients/admin';
import { type NutriAIBusinessContext } from './nutrai-business';
import { type NutriAITool, type NutriAIToolInput } from './nutrai-tools';

// NOTE: nutrition_clients table does not exist yet — client identity lives as
// client_name / client_phone / client_email / client_document directly on
// nutrition_plans. All tools group by client_name as the de-facto client key.

export const searchClientsTool: NutriAITool = {
  name: 'search_clients',
  description:
    'Busca clientes por nombre (fragmento parcial) o lista los primeros 10 del negocio si no se pasa nombre. Retorna nombre, teléfono, email y cantidad de planes.',
  inputSchema: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'Nombre o fragmento del nombre a buscar. Vacío para listar todos.',
      },
    },
    required: [],
  },
  execute: async (context: NutriAIBusinessContext, params: NutriAIToolInput) => {
    const supabase = createAdminClient();
    const searchName = ((params.name as string | undefined) ?? '').trim();

    // Fetch enough rows to aggregate; use limit(100) here, we'll cap unique clients to 10 after grouping
    let query = supabase
      .from('nutrition_plans')
      .select('id, client_name, client_phone, client_email, created_at')
      .eq('business_id', context.businessId)
      .order('client_name')
      .order('created_at', { ascending: false });

    if (searchName) {
      query = query.ilike('client_name', `%${searchName}%`);
    }

    const { data: rows, error } = await query.limit(100);
    if (error) throw error;

    // Group by client_name — first occurrence (most recent plan) wins for contact fields
    const map = new Map<string, {
      name: string;
      phone: string | null;
      email: string | null;
      planCount: number;
      latestPlanId: string;
    }>();

    for (const row of rows ?? []) {
      const name = row.client_name as string;
      if (!map.has(name)) {
        map.set(name, {
          name,
          phone: row.client_phone as string | null,
          email: row.client_email as string | null,
          planCount: 0,
          latestPlanId: row.id as string,
        });
      }
      map.get(name)!.planCount++;
    }

    const clients = Array.from(map.values()).slice(0, 10);

    return {
      success: true,
      count: clients.length,
      clients,
      hint: 'Usa latestPlanId con get_active_plan o clientName con get_client_profile para obtener más detalle.',
    };
  },
};

export const getClientProfileTool: NutriAITool = {
  name: 'get_client_profile',
  description:
    'Obtiene el historial completo de planes de un cliente por nombre, con datos clínicos (patient_info) de cada plan. Si hay ambigüedad, retorna needsDisambiguation con la lista de nombres que coinciden.',
  inputSchema: {
    type: 'object',
    properties: {
      clientName: {
        type: 'string',
        description: 'Nombre exacto o parcial del cliente',
      },
    },
    required: ['clientName'],
  },
  execute: async (context: NutriAIBusinessContext, params: NutriAIToolInput) => {
    const supabase = createAdminClient();
    const clientName = ((params.clientName as string) ?? '').trim();
    if (!clientName) throw new Error('clientName es requerido');

    // Step 1: find unique matching names (never .maybeSingle() — queremos la lista)
    const { data: matchRows, error: searchErr } = await supabase
      .from('nutrition_plans')
      .select('client_name')
      .eq('business_id', context.businessId)
      .ilike('client_name', `%${clientName}%`);

    if (searchErr) throw searchErr;

    const uniqueNames = [...new Set((matchRows ?? []).map((r) => r.client_name as string))];

    if (uniqueNames.length === 0) {
      return {
        success: false,
        error: `No se encontró ningún cliente con nombre similar a "${clientName}"`,
      };
    }

    if (uniqueNames.length > 1) {
      return {
        success: false,
        needsDisambiguation: true,
        matches: uniqueNames,
        message: `Hay ${uniqueNames.length} clientes que coinciden con "${clientName}". ¿A cuál te refieres?`,
      };
    }

    // Step 2: exactly one unique name — fetch all plans + patient_info
    const exactName = uniqueNames[0];

    const { data: plans, error: plansErr } = await supabase
      .from('nutrition_plans')
      .select('id, client_name, client_phone, client_email, client_document, duration_days, notes, created_at, patient_info(*)')
      .eq('business_id', context.businessId)
      .eq('client_name', exactName)
      .order('created_at', { ascending: false });

    if (plansErr) throw plansErr;

    // Flatten patient_info from PostgREST one-to-many array to single object
    const plansFormatted = ((plans ?? []) as Array<Record<string, unknown>>).map((p) => {
      const pi = p.patient_info;
      return {
        ...p,
        patient_info: Array.isArray(pi) ? (pi[0] ?? null) : (pi ?? null),
      };
    });

    const latest: Record<string, unknown> | undefined = plansFormatted[0];

    return {
      success: true,
      client: {
        name: exactName,
        phone: (latest?.client_phone as string | null) ?? null,
        email: (latest?.client_email as string | null) ?? null,
        document: (latest?.client_document as string | null) ?? null,
      },
      planCount: plansFormatted.length,
      plans: plansFormatted,
    };
  },
};

export const getActivePlanTool: NutriAITool = {
  name: 'get_active_plan',
  description:
    'Obtiene el plan nutricional más reciente de un cliente con sus comidas agrupadas por día. Requiere planId (UUID del plan — usar latestPlanId de search_clients o el id de get_client_profile).',
  inputSchema: {
    type: 'object',
    properties: {
      planId: {
        type: 'string',
        description: 'UUID del plan (nutrition_plans.id). Obtenerlo desde search_clients.latestPlanId o get_client_profile.plans[0].id.',
      },
    },
    required: ['planId'],
  },
  execute: async (context: NutriAIBusinessContext, params: NutriAIToolInput) => {
    const supabase = createAdminClient();
    const planId = (params.planId as string).trim();
    if (!planId) throw new Error('planId es requerido');

    const [planRes, mealsRes] = await Promise.all([
      supabase
        .from('nutrition_plans')
        .select('id, client_name, client_phone, duration_days, notes, created_at, patient_info(*)')
        .eq('id', planId)
        .eq('business_id', context.businessId),
      supabase
        .from('nutrition_plan_meals')
        .select('day, meal_type, foods, macros, notes')
        .eq('plan_id', planId)
        .order('day')
        .order('meal_type'),
    ]);

    if (planRes.error) throw planRes.error;
    if (!planRes.data || planRes.data.length === 0) {
      return { success: false, error: 'Plan no encontrado o sin acceso' };
    }

    const plan = planRes.data[0];
    const piRaw = plan.patient_info;
    const patientInfo = Array.isArray(piRaw) ? (piRaw[0] ?? null) : (piRaw ?? null);

    // Group meals by day
    type MealEntry = { meal_type: string; foods: unknown; macros: unknown; notes: unknown };
    const mealsByDay: Record<number, MealEntry[]> = {};
    for (const meal of mealsRes.data ?? []) {
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
        id: plan.id,
        clientName: plan.client_name,
        clientPhone: plan.client_phone,
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
    'Genera alertas sobre clientes del negocio: plan desactualizado (>30 días sin plan nuevo) y patient_info clínico incompleto (falta objetivo o datos clínicos clave).',
  inputSchema: {
    type: 'object',
    properties: {},
    required: [],
  },
  execute: async (context: NutriAIBusinessContext, _params: NutriAIToolInput) => {
    const supabase = createAdminClient();

    const { data: allPlans, error } = await supabase
      .from('nutrition_plans')
      .select('id, client_name, created_at, patient_info(objective, restrictions, allergies, medical_conditions)')
      .eq('business_id', context.businessId)
      .order('client_name')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // One entry per unique client_name — first row is their most recent plan (desc order)
    type ClientEntry = {
      name: string;
      latestCreatedAt: string;
      patientInfo: Record<string, unknown> | null;
    };
    const clientMap = new Map<string, ClientEntry>();

    for (const plan of allPlans ?? []) {
      const name = plan.client_name as string;
      if (!clientMap.has(name)) {
        const piRaw = plan.patient_info;
        const pi = Array.isArray(piRaw) ? (piRaw[0] ?? null) : (piRaw as Record<string, unknown> | null ?? null);
        clientMap.set(name, {
          name,
          latestCreatedAt: plan.created_at as string,
          patientInfo: pi,
        });
      }
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const stalePlanClients: string[] = [];
    const incompleteInfoClients: string[] = [];

    for (const client of clientMap.values()) {
      if (new Date(client.latestCreatedAt) < thirtyDaysAgo) {
        stalePlanClients.push(client.name);
      }

      const pi = client.patientInfo;
      const missingObjective = !pi?.objective;
      const missingClinical =
        (!pi?.restrictions || (pi.restrictions as unknown[]).length === 0) &&
        !pi?.allergies &&
        !pi?.medical_conditions;

      if (!pi || missingObjective || missingClinical) {
        incompleteInfoClients.push(client.name);
      }
    }

    return {
      success: true,
      totalClients: clientMap.size,
      alerts: {
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
        // noPlan category omitted: sin tabla nutrition_clients independiente,
        // no es posible conocer clientes que nunca han tenido un plan.
      },
      totalAlerts: stalePlanClients.length + incompleteInfoClients.length,
    };
  },
};
