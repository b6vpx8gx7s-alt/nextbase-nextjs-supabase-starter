import { createGymAdminClient } from '@/app/api/gym/_helpers';

export type RodaAIBusinessCategory = 'gym' | 'fisioterapia' | 'nutricion';

export interface RodaAIBusinessContext {
  category: RodaAIBusinessCategory;
  businessId: string;
  userId: string;
  userRole: 'client' | 'trainer';
  clientIdentifier?: string; // agnóstico: gym_client.id | patient.id | customer.id
  userName?: string;
}

/**
 * Detecta automáticamente si el usuario es entrenador o cliente
 * y retorna el business context correspondiente
 */
export async function getRodaAIBusinessContext(userId: string): Promise<RodaAIBusinessContext> {
  const supabase = createGymAdminClient();

  // 1. Verificar si es entrenador (tiene profile.business_id)
  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profile?.business_id) {
    return {
      category: 'gym',
      businessId: profile.business_id,
      userId,
      userRole: 'trainer',
    };
  }

  // 2. Verificar si es cliente gym (gym_clients.roda_customer_id)
  const { data: gymClient } = await supabase
    .from('gym_clients')
    .select('id, business_id, nombre')
    .eq('roda_customer_id', userId)
    .maybeSingle();

  if (gymClient) {
    return {
      category: 'gym',
      businessId: gymClient.business_id,
      userId,
      userRole: 'client',
      clientIdentifier: gymClient.id,
      userName: gymClient.nombre,
    };
  }

  throw new Error(`User ${userId} no tiene contexto válido (ni entrenador ni cliente gym)`);
}
