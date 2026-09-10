import { createGymAdminClient } from '@/app/api/gym/_helpers';

export type RodaAIUserRole = 'client' | 'trainer';

export interface RodaAIContext {
  userId: string;
  businessId?: string;
  gymClientId?: string;
  userRole: RodaAIUserRole;
  canAccessClientData: (clientId: string) => Promise<boolean>;
}

/**
 * Determina el contexto del usuario para RodaAI:
 * - Entrenador: tiene profile.business_id → ve todos sus clientes
 * - Cliente: tiene gym_client.roda_customer_id = userId → ve solo su propio perfil
 */
export async function getRodaAIContext(userId: string): Promise<RodaAIContext> {
  const supabase = createGymAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profileError) throw profileError;

  if (profile?.business_id) {
    const businessId = profile.business_id;
    return {
      userId,
      businessId,
      userRole: 'trainer',
      canAccessClientData: async (clientId: string) => {
        const { data: client } = await createGymAdminClient()
          .from('gym_clients')
          .select('id')
          .eq('id', clientId)
          .eq('business_id', businessId)
          .maybeSingle();
        return !!client;
      },
    };
  }

  const { data: gymClient } = await supabase
    .from('gym_clients')
    .select('id, business_id')
    .eq('roda_customer_id', userId)
    .maybeSingle();

  if (gymClient) {
    return {
      userId,
      businessId: gymClient.business_id,
      gymClientId: gymClient.id,
      userRole: 'client',
      canAccessClientData: async (clientId: string) => clientId === gymClient.id,
    };
  }

  throw new Error(`User ${userId} no tiene contexto válido (ni entrenador ni cliente)`);
}

export async function validateRodaAIAccess(
  userId: string,
  targetClientId: string
): Promise<void> {
  const context = await getRodaAIContext(userId);
  const canAccess = await context.canAccessClientData(targetClientId);
  if (!canAccess) {
    throw new Error(`Unauthorized: User ${userId} cannot access client ${targetClientId}`);
  }
}
