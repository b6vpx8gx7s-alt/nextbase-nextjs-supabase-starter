import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/supabase-clients/server';

export async function POST() {
  const supabase = await createSupabaseClient();

  let redirectUrl =
    process.env.NODE_ENV === 'production' ? 'https://www.roda.ink' : '/';

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase
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
