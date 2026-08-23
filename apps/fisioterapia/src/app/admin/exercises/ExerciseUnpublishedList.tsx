'use client';

import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ExerciseLightbox } from '@/components/fisio/ExerciseLightbox';

type UnpublishedExercise = {
  id: string;
  nombre: string;
  grupo_muscular: string;
  gif_url: string | null;
};

export function ExerciseUnpublishedList() {
  const [exercises, setExercises] = useState<UnpublishedExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Record<string, boolean>>({});

  const fetchExercises = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/fisio/exercises/unpublished');
      if (!res.ok) throw new Error();
      const { exercises: list } = await res.json() as { exercises: UnpublishedExercise[] };
      setExercises(list);
    } catch {
      toast.error('Error al cargar ejercicios despublicados');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExercises();
  }, [fetchExercises]);

  const handleRepublish = async (ex: UnpublishedExercise) => {
    setPending((p) => ({ ...p, [ex.id]: true }));
    try {
      const res = await fetch(`/api/fisio/exercises/${ex.id}/republish`, { method: 'PATCH' });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error');
      }
      setExercises((prev) => prev.filter((e) => e.id !== ex.id));
      toast.success(`"${ex.nombre}" publicado de nuevo`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setPending((p) => ({ ...p, [ex.id]: false }));
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-6">Cargando…</p>;
  }

  if (exercises.length === 0) {
    return (
      <div className="rounded-lg border border-dashed px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">Sin ejercicios despublicados.</p>
      </div>
    );
  }

  return (
    <div className="divide-y rounded-lg border">
      {exercises.map((ex) => (
        <div key={ex.id} className="flex items-center gap-4 px-4 py-3">
          <ExerciseLightbox gif_url={ex.gif_url} nombre={ex.nombre} className="h-10 w-10 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{ex.nombre}</p>
            <p className="text-xs text-muted-foreground capitalize">{ex.grupo_muscular}</p>
          </div>
          <button
            onClick={() => handleRepublish(ex)}
            disabled={pending[ex.id]}
            className="shrink-0 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {pending[ex.id] ? 'Publicando…' : 'Publicar de nuevo'}
          </button>
        </div>
      ))}
    </div>
  );
}
