import { NextRequest } from 'next/server';
import { withRodaAIContext } from '../context';
import { validateRodaAIAccess } from '@/lib/rodaai-context';

/**
 * GET /api/gym/rodaai/test-access?clientId=<uuid>
 * Valida que el usuario autenticado puede acceder a los datos de ese cliente.
 * - Entrenador: el cliente debe pertenecer a su negocio
 * - Cliente: solo puede acceder a su propio perfil
 */
export async function GET(request: NextRequest) {
  return withRodaAIContext(request, async (context) => {
    const clientId = request.nextUrl.searchParams.get('clientId');

    if (!clientId) {
      throw new Error('Missing clientId query parameter');
    }

    await validateRodaAIAccess(context.userId, clientId);

    return {
      ok: true,
      message: `${context.userRole} has access to client ${clientId}`,
      userRole: context.userRole,
      businessId: context.businessId,
      gymClientId: context.gymClientId,
    };
  });
}
