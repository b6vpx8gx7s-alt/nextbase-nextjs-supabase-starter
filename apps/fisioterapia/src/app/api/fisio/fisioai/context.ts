import { NextRequest } from 'next/server';
import { createFisioClient } from '../_helpers';
import { getFisioAIBusinessContext, type FisioAIBusinessContext } from '@/lib/fisioai-business';

export async function extractFisioAIContext(request: NextRequest): Promise<FisioAIBusinessContext> {
  void request; // auth comes from cookies, not the request body
  const supabase = await createFisioClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new Error('Unauthorized: No authenticated user');
  }

  return getFisioAIBusinessContext(user.id);
}

export async function withFisioAIContext<T>(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (context: FisioAIBusinessContext, body: any) => Promise<T>
): Promise<Response> {
  try {
    const context = await extractFisioAIContext(request);
    const body = request.method === 'POST' ? await request.json() : {};
    const result = await handler(context, body);
    return Response.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('[FisioAI Context Error]', message);
    const status = message.startsWith('Unauthorized') ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
