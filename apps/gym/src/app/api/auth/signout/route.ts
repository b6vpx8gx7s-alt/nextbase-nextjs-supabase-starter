import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/supabase-clients/server';
import { createGymAdminClient } from '@/app/api/gym/_helpers';

export async function POST() {
  const supabase = await createSupabaseClient();

  let redirectUrl =
    process.env.NODE_ENV === 'production' ? 'https://www.roda.ink' : '/';

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    // Use admin client: gym clients have no access to gym_clients rows (RLS owner-only)
    const admin = createGymAdminClient();
    const { data } = await admin
      .from('gym_client_users')
      .select('gym_clients(businesses(slug))')
      .eq('auth_user_id', user.id)
      .maybeSingle();
    const slug = (data as any)?.gym_clients?.businesses?.slug as string | undefined;
    if (slug) redirectUrl = `https://www.roda.ink/book/${slug}`;
  }

  await supabase.auth.signOut();
  return NextResponse.redirect(redirectUrl, { status: 303 });
}
