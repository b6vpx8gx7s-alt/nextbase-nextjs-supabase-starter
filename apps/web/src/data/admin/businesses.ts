'use server';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

const ADMIN_MASTER_EMAILS = (process.env.ADMIN_MASTER_EMAILS ?? '').split(',').map(e => e.trim()).filter(Boolean);

export type BusinessCategory = 'tatuaje' | 'barberia' | 'spa' | 'nutricion' | 'otro';

export type BusinessRow = {
  id: string;
  name: string;
  slug: string;
  category: BusinessCategory | null;
  active: boolean;
  plan: string | null;
};

async function createServiceClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (s) => s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  );
}

async function requireAdminMaster() {
  const supabase = await createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email || !ADMIN_MASTER_EMAILS.includes(user.email)) {
    redirect('/dashboard');
  }
  return user;
}

export async function getAdminBusinesses(): Promise<BusinessRow[]> {
  await requireAdminMaster();
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('businesses')
    .select('id, name, slug, category, active, plan')
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as BusinessRow[];
}

const updateCategorySchema = z.object({
  businessId: z.string().uuid(),
  category: z.enum(['tatuaje', 'barberia', 'spa', 'nutricion', 'otro']),
});

export async function updateBusinessCategoryAction(formData: FormData) {
  await requireAdminMaster();

  const parsed = updateCategorySchema.safeParse({
    businessId: formData.get('businessId'),
    category: formData.get('category'),
  });

  if (!parsed.success) throw new Error('Datos inválidos');

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from('businesses')
    .update({ category: parsed.data.category })
    .eq('id', parsed.data.businessId);

  if (error) throw new Error(error.message);

  revalidatePath('/admin-master');
}
