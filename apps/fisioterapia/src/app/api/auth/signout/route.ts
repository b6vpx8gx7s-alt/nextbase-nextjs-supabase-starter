import { NextResponse } from 'next/server';
import { createSupabaseClient } from '@/supabase-clients/server';

const LOGIN_URL =
  process.env.NODE_ENV === 'production'
    ? 'https://www.roda.ink/login'
    : '/login';

export async function POST() {
  const supabase = await createSupabaseClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(LOGIN_URL, { status: 303 });
}
