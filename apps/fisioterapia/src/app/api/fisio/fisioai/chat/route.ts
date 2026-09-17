import { NextRequest } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { withFisioAIContext } from '../context';
import { createFisioAdminClient } from '@/app/api/fisio/_helpers';
import { buildFisioAISystemPrompt } from '@/lib/fisioai-prompt';
import { getFisioAIBusinessContext } from '@/lib/fisioai-business';
import { FISIO_TOOLS } from '@/lib/fisioai-tools';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  return withFisioAIContext(request, async (context, body) => {
    const { message, conversationId } = body as { message: string; conversationId?: string };

    if (!message?.trim()) throw new Error('Message is required');

    const businessContext = await getFisioAIBusinessContext(context.userId);
    const systemPrompt = buildFisioAISystemPrompt(businessContext);

    const tools = FISIO_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema,
    }));

    const supabase = createFisioAdminClient();

    const isNewConversation = !conversationId;
    let conversId = conversationId;
    let priorMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    if (isNewConversation) {
      const { data: newConv, error: convInsertError } = await supabase
        .from('fisioai_conversations')
        .insert({
          business_id: businessContext.businessId,
          user_id: context.userId,
          category: 'fisioterapia',
          title: message.substring(0, 50),
          messages: [{ role: 'user', content: message, timestamp: new Date().toISOString() }],
        })
        .select('id')
        .single();
      if (convInsertError) console.error('[FisioAI] Error creating conversation:', convInsertError.message);
      conversId = newConv?.id;
    } else {
      const { data: conv } = await supabase
        .from('fisioai_conversations')
        .select('messages')
        .eq('id', conversId)
        .single();
      const stored = (conv?.messages as Array<{ role: string; content: string }>) ?? [];
      priorMessages = stored.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
    }

    let messages: Anthropic.Messages.MessageParam[] = [
      ...priorMessages,
      { role: 'user', content: message },
    ];
    let fullResponse = '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toolsUsed: Array<{ name: string; params: any }> = [];

    try {
      for (let i = 0; i < 5; i++) {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system: systemPrompt,
          tools: tools as Anthropic.Messages.Tool[],
          messages,
        });

        const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
        let hasToolUse = false;

        for (const block of response.content) {
          if (block.type === 'text') {
            fullResponse += block.text;
          } else if (block.type === 'tool_use') {
            hasToolUse = true;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const toolParams = block.input as Record<string, any>;
            const tool = FISIO_TOOLS.find((t) => t.name === block.name);
            if (!tool) throw new Error(`Tool ${block.name} not found`);

            let toolResultContent: string;
            let isError = false;

            try {
              const result = await tool.execute(businessContext, toolParams);
              toolResultContent = JSON.stringify(result);
              toolsUsed.push({ name: block.name, params: toolParams });

              await supabase.from('fisioai_tool_logs').insert({
                business_id: businessContext.businessId,
                user_id: context.userId,
                tool_name: block.name,
                category: 'fisioterapia',
                user_role: businessContext.userRole,
                params: toolParams,
                result_size: toolResultContent.length,
              });
            } catch (err) {
              toolResultContent = `Error: ${err instanceof Error ? err.message : String(err)}`;
              isError = true;
              console.error(`[FisioAI] Tool ${block.name} error:`, toolResultContent);
            }

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: toolResultContent,
              ...(isError ? { is_error: true } : {}),
            });
          }
        }

        if (hasToolUse) {
          messages.push({ role: 'assistant', content: response.content });
          messages.push({ role: 'user', content: toolResults });
        }

        if (response.stop_reason === 'end_turn') break;
      }
    } catch (err: unknown) {
      const errMessage = err instanceof Error ? err.message : String(err);
      if (errMessage.includes('credit balance is too low')) {
        console.error('[FisioAI] Anthropic credit exhausted:', errMessage);
        throw new Error('FisioAI no está disponible temporalmente. Por favor contacta al administrador de la plataforma.');
      }
      throw err;
    }

    if (conversId) {
      let updatedMessages: unknown[];

      if (isNewConversation) {
        const { data: conv } = await supabase
          .from('fisioai_conversations')
          .select('messages')
          .eq('id', conversId)
          .single();
        updatedMessages = [
          ...((conv?.messages as unknown[]) ?? []),
          { role: 'assistant', content: fullResponse, timestamp: new Date().toISOString(), toolsUsed },
        ];
      } else {
        updatedMessages = [
          ...priorMessages,
          { role: 'user', content: message, timestamp: new Date().toISOString() },
          { role: 'assistant', content: fullResponse, timestamp: new Date().toISOString(), toolsUsed },
        ];
      }

      const { error: convUpdateError } = await supabase
        .from('fisioai_conversations')
        .update({ messages: updatedMessages })
        .eq('id', conversId);
      if (convUpdateError) console.error('[FisioAI] Error updating conversation:', convUpdateError.message);
    }

    return { ok: true, message: fullResponse, conversationId: conversId, toolsUsed };
  });
}
