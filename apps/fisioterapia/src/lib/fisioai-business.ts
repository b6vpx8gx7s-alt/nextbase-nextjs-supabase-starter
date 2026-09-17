import { createAdminClient } from '@/supabase-clients/admin';

export interface FisioAIBusinessContext {
  businessId: string;
  userId: string;
  userRole: 'trainer' | 'employee' | 'client';
  clientIdentifier?: string; // physio_client.id cuando es paciente
  userName?: string;
}

export async function getFisioAIBusinessContext(userId: string): Promise<FisioAIBusinessContext> {
  const supabase = createAdminClient();

  // 1. Owner: tiene profiles.business_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('business_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (profile?.business_id) {
    return {
      businessId: profile.business_id,
      userId,
      userRole: 'trainer',
    };
  }

  // 2. Empleado: tiene employee_auth → employees.business_id
  const { data: empAuth } = await supabase
    .from('employee_auth')
    .select('employee_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (empAuth?.employee_id) {
    const { data: employee } = await supabase
      .from('employees')
      .select('business_id')
      .eq('id', empAuth.employee_id)
      .maybeSingle();

    if (employee?.business_id) {
      return {
        businessId: employee.business_id,
        userId,
        userRole: 'employee',
      };
    }
  }

  // 3. Paciente: tiene physio_client_users
  const { data: clientLink } = await supabase
    .from('physio_client_users')
    .select('physio_client_id')
    .eq('auth_user_id', userId)
    .maybeSingle();

  if (clientLink?.physio_client_id) {
    const { data: physioClient } = await supabase
      .from('physio_clients')
      .select('id, business_id, nombre')
      .eq('id', clientLink.physio_client_id)
      .maybeSingle();

    if (physioClient?.business_id) {
      return {
        businessId: physioClient.business_id,
        userId,
        userRole: 'client',
        clientIdentifier: physioClient.id,
        userName: physioClient.nombre ?? undefined,
      };
    }
  }

  throw new Error(`User ${userId} no tiene contexto válido en fisioterapia`);
}
