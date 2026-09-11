'use client';

import { useEffect, useState } from 'react';

interface Suggestion {
  id: string;
  client_id: string;
  session_id: string | null;
  suggested_text: string;
  suggested_type: string;
  source_quote: string | null;
  status: string;
  created_at: string;
  gym_clients: { nombre: string } | null;
}

interface LimitationSuggestionsProps {
  userRole: 'trainer' | 'client';
}

export function LimitationSuggestions({ userRole }: LimitationSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/gym/rodaai/limitation-suggestions')
      .then((r) => r.json())
      .then((d) => setSuggestions(d.suggestions ?? []))
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  if (userRole === 'client') return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-52" />
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  const handleAction = async (suggestionId: string, action: 'accept' | 'reject') => {
    setResolving(suggestionId);
    try {
      const res = await fetch('/api/gym/rodaai/limitation-suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionId, action }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      }
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="rounded-xl border border-purple-200 bg-white mb-6 overflow-hidden">
      <div className="px-4 py-3 border-b border-purple-100 flex items-center justify-between bg-purple-50">
        <span className="text-sm font-semibold text-purple-800 flex items-center gap-2">
          🧠 Limitaciones sugeridas por IA
        </span>
        <span className="text-xs font-medium bg-purple-600 text-white rounded-full px-2 py-0.5">
          {suggestions.length}
        </span>
      </div>
      <ul className="divide-y divide-gray-100">
        {suggestions.map((s) => (
          <li key={s.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">
                  {s.gym_clients?.nombre ?? 'Cliente desconocido'}
                </p>
                <p className="text-sm text-gray-700 mt-0.5">{s.suggested_text}</p>
                {s.source_quote && (
                  <p className="text-xs text-gray-400 italic mt-1 line-clamp-2">
                    &ldquo;{s.source_quote}&rdquo;
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleAction(s.id, 'accept')}
                disabled={resolving === s.id}
                className="flex-1 text-xs font-medium py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {resolving === s.id ? '…' : 'Aceptar'}
              </button>
              <button
                onClick={() => handleAction(s.id, 'reject')}
                disabled={resolving === s.id}
                className="flex-1 text-xs font-medium py-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                {resolving === s.id ? '…' : 'Rechazar'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
