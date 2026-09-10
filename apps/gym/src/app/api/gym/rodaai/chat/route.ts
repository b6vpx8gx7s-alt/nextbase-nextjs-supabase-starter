import { NextRequest } from 'next/server';
import { withRodaAIContext } from '../context';
import { createGymAdminClient } from '@/app/api/gym/_helpers';
import { buildRodaAISystemPrompt } from '@/lib/rodaai-prompt';
import { getRodaAIBusinessContext } from '@/lib/rodaai-business';

/**
 * POST /api/gym/rodaai/chat
 * Streaming endpoint para conversar con RodaAI
 *
 * Request body: { message: string }
 * Response: JSON (Fase 0); SSE streaming en Fase 1
 */
export async function POST(request: NextRequest) {
  return withRodaAIContext(request, async (context, body) => {
    const { message } = body as { message: string };

    if (!message?.trim()) {
      throw new Error('Message is required');
    }

    const businessContext = await getRodaAIBusinessContext(context.userId);
    // systemPrompt se usará en Fase 1 cuando conectemos Claude API
    void buildRodaAISystemPrompt(businessContext);

    const supabase = createGymAdminClient();

    const { data: conversation } = await supabase
      .from('rodaai_conversations')
      .insert({
        business_id: businessContext.businessId,
        user_id: context.userId,
        category: businessContext.category,
        title: message.substring(0, 50),
        messages: [
          {
            role: 'user',
            content: message,
            timestamp: new Date().toISOString(),
          },
        ],
      })
      .select('id')
      .single();

    const mockResponse = `Echo de Fase 0: "${message}"\n\n⚠️ En Fase 1 conectaremos con Claude API y habilitaremos tools reales.`;

    await supabase.from('rodaai_tool_logs').insert({
      business_id: businessContext.businessId,
      user_id: context.userId,
      tool_name: 'chat_message',
      category: businessContext.category,
      user_role: businessContext.userRole,
      params: { message },
      result_size: mockResponse.length,
    });

    if (conversation?.id) {
      await supabase
        .from('rodaai_conversations')
        .update({
          messages: [
            {
              role: 'user',
              content: message,
              timestamp: new Date().toISOString(),
            },
            {
              role: 'assistant',
              content: mockResponse,
              timestamp: new Date().toISOString(),
            },
          ],
        })
        .eq('id', conversation.id);
    }

    return {
      ok: true,
      message: mockResponse,
      conversationId: conversation?.id,
    };
  });
}
