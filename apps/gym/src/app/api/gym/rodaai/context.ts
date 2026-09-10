import { NextRequest } from 'next/server';
import { createGymClient } from '../_helpers';
import { getRodaAIContext, type RodaAIContext } from '@/lib/rodaai-context';

export async function extractRodaAIContext(request: NextRequest): Promise<RodaAIContext> {
  void request; // auth comes from cookies, not the request body
  const supabase = await createGymClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new Error('Unauthorized: No authenticated user');
  }

  return getRodaAIContext(user.id);
}

export async function withRodaAIContext<T>(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (context: RodaAIContext, body: any) => Promise<T>
): Promise<Response> {
  try {
    const context = await extractRodaAIContext(request);
    const body = request.method === 'POST' ? await request.json() : {};
    const result = await handler(context, body);
    return Response.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('[RodaAI Context Error]', message);
    const status = message.startsWith('Unauthorized') ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
