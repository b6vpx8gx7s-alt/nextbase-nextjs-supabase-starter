// Types compartidos reutilizables en Fase 1+
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp?: string;
  toolCall?: {
    toolName: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    params: any;
  };
}

export interface Conversation {
  id: string;
  businessId: string;
  userId: string;
  category: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}
