'use client';

import { useState, useRef, useEffect } from 'react';
import { type RodaAIBusinessContext } from '@/lib/rodaai-business';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolsUsed?: Array<{ name: string; params: any }>;
}

export interface RodaAIPanelProps {
  context: RodaAIBusinessContext;
}

export function RodaAIPanel({ context }: RodaAIPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const inputValue = input;
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/gym/rodaai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: inputValue, conversationId }),
      });

      if (!response.ok) throw new Error(`Failed: ${response.status}`);

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.message,
          timestamp: new Date().toISOString(),
          toolsUsed: data.toolsUsed,
        },
      ]);
      if (data.conversationId) setConversationId(data.conversationId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Error desconocido';
      console.error('[RodaAI Error]', message);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Error: ${message}`, timestamp: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <aside className="w-96 border-l border-gray-200 bg-white flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 p-4 bg-gradient-to-r from-[#1B8BA8] to-[#0E5A6E]">
        <h2 className="text-white font-bold text-sm">🤖 RodaAI</h2>
        <p className="text-xs text-gray-200 mt-1">
          {context.userRole === 'trainer' ? 'Coach Assistant' : 'Personal Coach'}
        </p>
      </div>

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm py-8">
            <p>Hola 👋</p>
            <p className="mt-2 text-xs">
              {context.userRole === 'trainer'
                ? 'Pregúntame sobre tus clientes, rutinas, o analytics'
                : 'Pregúntame sobre tu entrenamiento y metas'}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold bg-gray-200">
              {msg.role === 'user' ? '👤' : '🤖'}
            </div>
            <div
              className={`max-w-xs text-sm rounded-lg p-3 ${
                msg.role === 'user' ? 'bg-[#1B8BA8] text-white' : 'bg-gray-100 text-gray-900'
              }`}
            >
              <p>{msg.content}</p>
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <p className="text-xs text-gray-600 mt-2 border-t pt-2">
                  🔧 Usé: {msg.toolsUsed.map((t) => t.name).join(', ')}
                </p>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
              🤖
            </div>
            <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-500">Pensando...</div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSendMessage} className="border-t border-gray-200 p-4 bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe aquí..."
            disabled={loading}
            className="flex-1 px-3 py-2 rounded border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#1B8BA8] disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-3 py-2 bg-[#1B8BA8] text-white rounded text-sm font-medium hover:bg-[#0E5A6E] disabled:bg-gray-300 transition-colors"
          >
            {loading ? '...' : 'Enviar'}
          </button>
        </div>
      </form>
    </aside>
  );
}
