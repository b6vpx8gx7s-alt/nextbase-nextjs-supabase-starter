'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';

type ContextSuggestion = {
  id: string;
  exercise_id: string;
  exercise_nombre: string;
  grupo_muscular: string | null;
  patron: string | null;
  motivo: string | null;
};

export function FisioContextSuggestionList({
  initialPending,
}: {
  initialPending: ContextSuggestion[];
}) {
  const [suggestions, setSuggestions] = useState(initialPending);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);

  const allSelected = suggestions.length > 0 && selected.size === suggestions.length;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(suggestions.map((s) => s.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const removeResolved = (ids: string[]) => {
    setSuggestions((prev) => prev.filter((s) => !ids.includes(s.id)));
    setSelected(new Set());
  };

  const handleAction = async (action: 'accept' | 'reject') => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/fisio-context-suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suggestionIds: ids, action }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error');
      }
      removeResolved(ids);
      toast.success(
        action === 'accept'
          ? `${ids.length} ejercicio(s) añadido(s) al catálogo de fisioterapia`
          : `${ids.length} sugerencia(s) rechazada(s)`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (suggestions.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Sin candidatos de contexto fisioterapia pendientes.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {selected.size > 0
            ? `${selected.size} de ${suggestions.length} seleccionados`
            : `${suggestions.length} candidatos pendientes de revisión`}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => handleAction('reject')}
            disabled={selected.size === 0 || loading}
            className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
          >
            Rechazar seleccionados
          </button>
          <button
            onClick={() => handleAction('accept')}
            disabled={selected.size === 0 || loading}
            className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
          >
            Aprobar seleccionados
          </button>
        </div>
      </div>

      <div className="rounded-lg border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="w-10 px-4 py-2 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-gray-300"
                />
              </th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Ejercicio</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Grupo muscular</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Patrón</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Motivo clínico</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {suggestions.map((s) => (
              <tr
                key={s.id}
                className={`${selected.has(s.id) ? 'bg-primary/5' : 'hover:bg-muted/30'} transition-colors`}
              >
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.has(s.id)}
                    onChange={() => toggleOne(s.id)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                </td>
                <td className="px-3 py-3 font-medium">{s.exercise_nombre}</td>
                <td className="px-3 py-3 text-muted-foreground">{s.grupo_muscular ?? '—'}</td>
                <td className="px-3 py-3 text-muted-foreground">{s.patron ?? '—'}</td>
                <td className="px-3 py-3 text-muted-foreground text-xs max-w-xs truncate">
                  {s.motivo ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
