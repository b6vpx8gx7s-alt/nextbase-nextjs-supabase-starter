import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { withRodaAIContext } from '../context';
import { createGymAdminClient } from '@/app/api/gym/_helpers';
import { buildRodaAISystemPrompt } from '@/lib/rodaai-prompt';
import { getRodaAIBusinessContext } from '@/lib/rodaai-business';
import { GYM_TOOLS } from '@/lib/rodaai-tools-gym';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * POST /api/gym/rodaai/chat
 * Endpoint con Claude API real + tool use.
 * Retorna JSON (streaming SSE en Fase 2).
 */
export async function POST(request: NextRequest) {
  return withRodaAIContext(request, async (context, body) => {
    const { message, conversationId } = body as { message: string; conversationId?: string };

    if (!message?.trim()) throw new Error('Message is required');

    const businessContext = await getRodaAIBusinessContext(context.userId);
    const systemPrompt = buildRodaAISystemPrompt(businessContext);

    const tools = GYM_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));

    const supabase = createGymAdminClient();

    // Crear conversación si no existe
    let conversId = conversationId;
    if (!conversId) {
      const { data: newConv } = await supabase
        .from('rodaai_conversations')
        .insert({
          business_id: businessContext.businessId,
          user_id: context.userId,
          category: businessContext.category,
          title: message.substring(0, 50),
          messages: [{ role: 'user', content: message, timestamp: new Date().toISOString() }],
        })
        .select('id')
        .single();
      conversId = newConv?.id;
    }

    let messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: message }];
    let fullResponse = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolsUsed: Array<{ name: string; params: any }> = [];

    // Agentic loop — máximo 5 iteraciones
    for (let i = 0; i < 5; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        tools: tools as Anthropic.Messages.Tool[],
        messages,
      });

      for (const block of response.content) {
        if (block.type === 'text') {
          fullResponse += block.text;
        } else if (block.type === 'tool_use') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const toolParams = block.input as Record<string, any>;
          const tool = GYM_TOOLS.find((t) => t.name === block.name);
          if (!tool) throw new Error(`Tool ${block.name} not found`);

          let toolResultContent: string;
          let isError = false;

          try {
            const result = await tool.execute(businessContext, toolParams);
            toolResultContent = JSON.stringify(result);
            toolsUsed.push({ name: block.name, params: toolParams });

            await supabase.from('rodaai_tool_logs').insert({
              business_id: businessContext.businessId,
              user_id: context.userId,
              tool_name: block.name,
              category: businessContext.category,
              user_role: businessContext.userRole,
              params: toolParams,
              result_size: toolResultContent.length,
            });
          } catch (err) {
            toolResultContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
            isError = true;
            console.error(`[RodaAI] Tool ${block.name} error:`, toolResultContent);
          }

          messages.push({ role: 'assistant', content: response.content });
          messages.push({
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: block.id,
                content: toolResultContent,
                ...(isError ? { is_error: true } : {}),
              },
            ],
          });
        }
      }

      if (response.stop_reason === 'end_turn') break;
    }

    // Persistir respuesta en la conversación
    if (conversId) {
      const { data: conv } = await supabase
        .from('rodaai_conversations')
        .select('messages')
        .eq('id', conversId)
        .single();

      await supabase
        .from('rodaai_conversations')
        .update({
          messages: [
            ...((conv?.messages as unknown[]) ?? []),
            {
              role: 'assistant',
              content: fullResponse,
              timestamp: new Date().toISOString(),
              toolsUsed,
            },
          ],
        })
        .eq('id', conversId);
    }

    return { ok: true, message: fullResponse, conversationId: conversId, toolsUsed };
  });
}
