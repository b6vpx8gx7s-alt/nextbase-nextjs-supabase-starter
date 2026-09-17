import { NextRequest } from 'next/server';
import { createNutritionClient } from '../_helpers';
import { getNutriAIBusinessContext, type NutriAIBusinessContext } from '@/lib/nutrai-business';

export async function extractNutriAIContext(request: NextRequest): Promise<NutriAIBusinessContext> {
  void request; // auth comes from cookies, not the request body
  const supabase = await createNutritionClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user?.id) {
    throw new Error('Unauthorized: No authenticated user');
  }

  return getNutriAIBusinessContext(user.id);
}

export async function withNutriAIContext<T>(
  request: NextRequest,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (context: NutriAIBusinessContext, body: any) => Promise<T>
): Promise<Response> {
  try {
    const context = await extractNutriAIContext(request);
    const body = request.method === 'POST' ? await request.json() : {};
    const result = await handler(context, body);
    return Response.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal error';
    console.error('[NutriAI Context Error]', message);
    const status = message.startsWith('Unauthorized') ? 401 : 400;
    return Response.json({ error: message }, { status });
  }
}
