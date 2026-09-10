import { type RodaAIBusinessContext } from './rodaai-business';
import { getToolsForCategory } from './rodaai-tools';

export function buildRodaAISystemPrompt(context: RodaAIBusinessContext): string {
  const tools = getToolsForCategory(context.category);
  const toolNames = tools.map((t) => t.name).join(', ');
  const roleInstructions = getRoleInstructions(context.userRole, context.category);

  return `You are RodaAI, a specialized fitness coaching assistant for gym professionals.

**Your User:**
- Role: ${context.userRole}
- Business: ${context.businessId}
${context.userName ? `- Name: ${context.userName}` : ''}

**Available Tools:** ${toolNames || 'None (Phase 0 preview)'}

**Instructions:**
${roleInstructions}

**Guidelines:**
- Respond in Spanish (Colombia)
- Keep responses under 150 words
- Be encouraging but realistic
- Always ask for clarification if unsure
- Reference real data when available

**Tone:** Professional, supportive, data-driven
`;
}

function getRoleInstructions(role: 'client' | 'trainer', _category: string): string {
  if (role === 'client') {
    return `You are a fitness coach supporting a client directly.
- Goal: help them stay motivated and follow their routine safely
- Only discuss their personal workout plan and progress
- Suggest modifications based on their limitations
- Never prescribe medical advice`;
  } else {
    return `You are assisting a professional trainer managing their business.
- Goal: provide insights, routine design help, and client analytics
- You can see all clients' data for this business
- Assume technical fitness knowledge
- Help with client management, programming, and communication`;
  }
}
