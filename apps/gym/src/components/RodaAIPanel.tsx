'use client'

import { useState, useRef, useEffect } from 'react'
import { type RodaAIBusinessContext } from '@/lib/rodaai-business'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toolsUsed?: Array<{ name: string; params: any }>
}

export interface RodaAIPanelProps {
  context: RodaAIBusinessContext
}

const SUGGESTIONS = [
  '¿Cuántos clientes tengo?',
  '¿Hay alertas pendientes?',
]

export function RodaAIPanel({ context }: RodaAIPanelProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [hasUnread, setHasUnread] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversationId, setConversationId] = useState<string>()
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) scrollToBottom()
  }, [messages, isOpen])

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return

    const userMessage: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/gym/rodaai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, conversationId }),
      })

      if (!response.ok) throw new Error(`Failed: ${response.status}`)

      const data = await response.json()

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.message,
        timestamp: new Date().toISOString(),
        toolsUsed: data.toolsUsed,
      }

      setMessages((prev) => [...prev, assistantMessage])
      if (data.conversationId) setConversationId(data.conversationId)
      if (!isOpen) setHasUnread(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Error desconocido'
      console.error('[RodaAI Error]', message)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${message}`,
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleOpen = () => {
    setIsOpen(true)
    setHasUnread(false)
  }

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

  if (!isOpen) {
    return (
      <button
        onClick={handleOpen}
        aria-label="Abrir RodaAI"
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #1B8BA8, #3DD9B0)',
          border: 'none',
          boxShadow: '0 2px 8px rgba(15,39,48,0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 50,
        }}
      >
        <span style={{ fontSize: 24 }}>✨</span>
        {hasUnread && (
          <span
            style={{
              position: 'absolute',
              top: -2,
              right: -2,
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#E24B4A',
              border: '2px solid white',
            }}
          />
        )}
      </button>
    )
  }

  return (
    <aside
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        width: 320,
        height: 480,
        borderRadius: 12,
        overflow: 'hidden',
        border: '0.5px solid #e5e5e5',
        boxShadow: '0 4px 16px rgba(15,39,48,0.16)',
        display: 'flex',
        flexDirection: 'column',
        background: 'white',
        zIndex: 50,
      }}
    >
      <div
        style={{
          background: 'linear-gradient(135deg, #0F2730 0%, #143842 100%)',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #1B8BA8, #3DD9B0)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16 }}>✨</span>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'white' }}>RodaAI</div>
          <div style={{ fontSize: 12, color: '#9fd9e8', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3DD9B0', display: 'inline-block' }} />
            {context.userRole === 'trainer' ? 'Coach assistant' : 'Personal coach'}
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          aria-label="Minimizar"
          style={{
            width: 22,
            height: 22,
            padding: 0,
            background: 'rgba(255,255,255,0.1)',
            border: 'none',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'white',
            fontSize: 14,
          }}
        >
          −
        </button>
      </div>

      <div
        style={{
          flex: 1,
          padding: '14px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          background: '#fafafa',
          overflowY: 'auto',
        }}
      >
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 8px 4px' }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1B8BA8, #3DD9B0)',
                margin: '0 auto 10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ fontSize: 20 }}>✨</span>
            </div>
            <div style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
              {context.userRole === 'trainer'
                ? 'Pregúntame sobre tus clientes, rutinas o alertas'
                : 'Pregúntame sobre tu entrenamiento y metas'}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  style={{
                    fontSize: 12,
                    padding: '6px 12px',
                    borderRadius: 999,
                    border: '0.5px solid #ccc',
                    background: 'white',
                    cursor: 'pointer',
                    color: '#111',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              display: 'flex',
              gap: 8,
              flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
            }}
          >
            {msg.role === 'assistant' && (
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #1B8BA8, #3DD9B0)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 2,
                }}
              >
                <span style={{ fontSize: 12 }}>✨</span>
              </div>
            )}
            <div
              style={{
                background: msg.role === 'user' ? '#1B8BA8' : 'white',
                color: msg.role === 'user' ? 'white' : '#111',
                padding: '8px 12px',
                borderRadius: msg.role === 'user' ? '16px 16px 3px 16px' : '3px 16px 16px 16px',
                fontSize: 13,
                lineHeight: 1.6,
                boxShadow: msg.role === 'user' ? '0 1px 2px rgba(0,0,0,0.08)' : '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              {msg.content}
              {msg.toolsUsed && msg.toolsUsed.length > 0 && (
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderTop: '0.5px solid #eee',
                    paddingTop: 6,
                  }}
                >
                  <span style={{ fontSize: 11, color: '#999' }}>
                    🔧 {msg.toolsUsed.map((t) => t.name).join(', ')}
                  </span>
                  <span style={{ fontSize: 11, color: '#999' }}>{formatTime(msg.timestamp)}</span>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #1B8BA8, #3DD9B0)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 12 }}>✨</span>
            </div>
            <div
              style={{
                background: 'white',
                padding: '10px 12px',
                borderRadius: '3px 16px 16px 16px',
                display: 'flex',
                gap: 4,
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#999', display: 'inline-block' }} />
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#999', display: 'inline-block' }} />
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#999', display: 'inline-block' }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form
        onSubmit={handleSendMessage}
        style={{
          padding: '10px 12px',
          background: 'white',
          borderTop: '0.5px solid #eee',
          display: 'flex',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregúntale a RodaAI..."
          disabled={loading}
          style={{
            flex: 1,
            fontSize: 13,
            padding: '8px 10px',
            borderRadius: 8,
            border: '0.5px solid #ccc',
            outline: 'none',
            color: '#111',
            background: 'white',
          }}
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar"
          style={{
            width: 36,
            height: 36,
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: input.trim() ? '#1B8BA8' : '#e0e0e0',
            border: 'none',
            borderRadius: 12,
            cursor: input.trim() ? 'pointer' : 'default',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 16, color: input.trim() ? 'white' : '#999' }}>➤</span>
        </button>
      </form>
    </aside>
  )
}
