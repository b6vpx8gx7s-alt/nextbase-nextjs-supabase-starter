import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/supabase-clients/server';
import { createFisioAdminClient } from '@/app/api/fisio/_helpers';

export async function POST() {
  const supabase = await createSupabaseClient();

  let redirectUrl =
    process.env.NODE_ENV === 'production' ? 'https://www.roda.ink' : '/';

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Use admin client: physio patients have no access to physio_clients rows (RLS owner-only)
    const admin = createFisioAdminClient();
    const { data } = await admin
      .from('physio_client_users')
      .select('physio_clients(businesses(slug))')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    const slug = (data as any)?.physio_clients?.businesses?.slug as string | undefined;
    if (slug) redirectUrl = `https://www.roda.ink/book/${slug}`;
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
