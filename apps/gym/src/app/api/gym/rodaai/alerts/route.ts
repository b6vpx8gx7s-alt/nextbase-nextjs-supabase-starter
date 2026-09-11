import { NextRequest } from 'next/server';
import { withRodaAIContext } from '../context';
import { getRodaAIBusinessContext } from '@/lib/rodaai-business';
import { getClientAlertsTool } from '@/lib/rodaai-tools-gym';

export async function GET(request: NextRequest) {
  return withRodaAIContext(request, async (context) => {
    const businessContext = await getRodaAIBusinessContext(context.userId);
    return getClientAlertsTool.execute(businessContext, {});
  });
}
