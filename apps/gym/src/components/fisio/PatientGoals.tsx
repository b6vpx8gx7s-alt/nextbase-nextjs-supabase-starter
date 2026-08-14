'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface Goal {
  id: string;
  descripcion: string;
  fecha_objetivo: string | null;
  estado: 'activo' | 'completado' | 'pausado';
  created_at: string;
}

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

interface Props {
  clientId: string;
}

export function PatientGoals({ clientId }: Props) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);

  // Form state
  const [descripcion, setDescripcion] = useState('');
  const [fechaObjetivo, setFechaObjetivo] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/gym/goals?client_id=${clientId}`)
      .then((r) => r.json())
      .then((d) => setGoals(d.goals ?? []))
      .catch(() => toast.error('Error al cargar objetivos'))
      .finally(() => setLoading(false));
  }, [clientId]);

  const openModal = () => {
    setDescripcion('');
    setFechaObjetivo('');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!descripcion.trim()) {
      toast.error('La descripción es requerida');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/gym/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          descripcion: descripcion.trim(),
          fecha_objetivo: fechaObjetivo || null,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error al guardar');
      }
      const { goal } = await res.json();
      setGoals((prev) => [goal, ...prev]);
      toast.success('Objetivo agregado');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const toggleGoal = async (goal: Goal) => {
    const nuevoEstado = goal.estado === 'completado' ? 'activo' : 'completado';
    setToggling(goal.id);
    try {
      const res = await fetch(`/api/gym/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error al actualizar');
      }
      const { goal: updated } = await res.json();
      setGoals((prev) => prev.map((g) => (g.id === updated.id ? updated : g)));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setToggling(null);
    }
  };

  const active = goals.filter((g) => g.estado !== 'completado');
  const completed = goals.filter((g) => g.estado === 'completado');

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Objetivos
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openModal}>
              <Plus className="h-4 w-4" />
              Agregar objetivo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : goals.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <Target className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sin objetivos registrados</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {[...active, ...completed].map((goal) => {
                const done = goal.estado === 'completado';
                return (
                  <li key={goal.id} className="flex items-start gap-3">
                    <button
                      onClick={() => toggleGoal(goal)}
                      disabled={toggling === goal.id}
                      className={`mt-0.5 h-4 w-4 shrink-0 rounded border-2 flex items-center justify-center transition-colors
                        ${done
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-muted-foreground hover:border-primary'
                        }`}
                      aria-label={done ? 'Marcar como activo' : 'Marcar como completado'}
                    >
                      {done && (
                        <svg viewBox="0 0 10 10" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="2">
                          <polyline points="1.5,5 4,7.5 8.5,2.5" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className={`text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>
                        {goal.descripcion}
                      </span>
                      {goal.fecha_objetivo && !done && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          → {formatDate(goal.fecha_objetivo)}
                        </span>
                      )}
                      {done && (
                        <span className="ml-2 text-xs text-muted-foreground">completado</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Agregar objetivo</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Descripción
                </label>
                <input
                  type="text"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: Caminar 1 km sin dolor"
                  autoFocus
                  className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Fecha objetivo (opcional)
                </label>
                <input
                  type="date"
                  value={fechaObjetivo}
                  onChange={(e) => setFechaObjetivo(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !descripcion.trim()}>
                {saving ? 'Guardando…' : 'Agregar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
