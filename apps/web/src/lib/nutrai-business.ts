import { createAdminClient } from '@/supabase-clients/admin';

export interface NutriAIBusinessContext {
  businessId: string;
  userId: string;
  userRole: 'owner' | 'employee';
  userName?: string;
}

export async function getNutriAIBusinessContext(userId: string): Promise<NutriAIBusinessContext> {
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
      userRole: 'owner',
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

  throw new Error(`User ${userId} no tiene contexto válido en nutrición`);
}
