'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { ExerciseThumb } from '@/components/fisio/ExerciseThumb';

type SuggestedExercise = {
  id: string;
  nombre: string;
  grupo_muscular: string;
  gif_url: string | null;
  business_name: string | null;
};

export function ExerciseApprovalList({ initialExercises }: { initialExercises: SuggestedExercise[] }) {
  const [exercises, setExercises] = useState(initialExercises);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const remove = (id: string) => setExercises((prev) => prev.filter((ex) => ex.id !== id));

  const handleAction = async (id: string, action: 'approve' | 'reject', nombre: string) => {
    setPending((p) => ({ ...p, [id]: true }));
    try {
      const res = await fetch(`/api/fisio/exercises/${id}/${action}`, { method: 'PATCH' });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error');
      }
      remove(id);
      toast.success(
        action === 'approve'
          ? `"${nombre}" aprobado y publicado en el catálogo`
          : `"${nombre}" rechazado`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setPending((p) => ({ ...p, [id]: false }));
    }
  };

  if (exercises.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Sin sugerencias pendientes.</p>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {exercises.map((ex) => (
        <div key={ex.id} className="flex items-center gap-4 px-4 py-3">
          <ExerciseThumb gif_url={ex.gif_url} className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{ex.nombre}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {ex.grupo_muscular}
              {ex.business_name && (
                <span className="ml-2 text-muted-foreground/70">· {ex.business_name}</span>
              )}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              onClick={() => handleAction(ex.id, 'approve', ex.nombre)}
              disabled={pending[ex.id]}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              Aprobar
            </button>
            <button
              onClick={() => handleAction(ex.id, 'reject', ex.nombre)}
              disabled={pending[ex.id]}
              className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-50 transition-colors"
            >
              Rechazar
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
