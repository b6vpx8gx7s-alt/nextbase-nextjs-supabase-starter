'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { ExerciseLightbox } from '@/components/fisio/ExerciseLightbox';
import type { PhysioRoutine, DraftDia, DraftEjercicio } from '@/lib/fisio-types';

const equipoLabel: Record<string, string> = {
  ninguno: 'Sin equipo',
  banda: 'Banda elástica',
  mancuernas: 'Mancuernas',
  barra: 'Barra',
  maquina: 'Máquina',
};

interface PendingChange {
  id: string;
  dia_index: number;
  old_exercise_id: string;
  old_exercise_nombre: string;
  new_exercise_id: string;
  new_exercise_nombre: string;
  new_gif_url: string | null;
  motivo: string | null;
}

function DayCard({
  dia,
  pendingChanges,
  onResolve,
}: {
  dia: DraftDia;
  pendingChanges: PendingChange[];
  onResolve: (changeId: string, action: 'accept' | 'reject', change: PendingChange) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{dia.nombre}</CardTitle>
        <p className="text-xs text-muted-foreground">{dia.ejercicios.length} ejercicios</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {dia.ejercicios.map((ej: DraftEjercicio, i: number) => {
          const pending = pendingChanges.find(
            (c) => c.dia_index === dia.dia_index && c.old_exercise_id === ej.exercise_id
          );

          if (pending) {
            return (
              <div key={i} className="rounded-md border border-amber-300 overflow-hidden">
                {/* Ejercicio actual - tachado */}
                <div className="p-3 space-y-1.5 bg-red-50 dark:bg-red-950/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ExerciseLightbox gif_url={ej.gif_url} nombre={ej.nombre} />
                      <span className="text-sm font-medium line-through text-muted-foreground">
                        {ej.nombre}
                      </span>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs opacity-60">
                      {ej.series}×{ej.repeticiones}
                    </Badge>
                  </div>
                </div>

                {/* Ejercicio propuesto */}
                <div className="p-3 space-y-1.5 bg-green-50 dark:bg-green-950/30">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <ExerciseLightbox gif_url={pending.new_gif_url} nombre={pending.new_exercise_nombre} />
                      <span className="text-sm font-medium text-green-800 dark:text-green-200">
                        {pending.new_exercise_nombre}
                      </span>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {ej.series}×{ej.repeticiones}
                    </Badge>
                  </div>
                  {pending.motivo && (
                    <p className="text-xs text-muted-foreground pl-6">{pending.motivo}</p>
                  )}
                  <p className="text-xs text-amber-700 dark:text-amber-400 pl-6">
                    Cambio sugerido por RodaAI — pendiente de confirmación
                  </p>
                </div>

                {/* Acciones */}
                <div className="flex border-t border-amber-200 dark:border-amber-800">
                  <button
                    onClick={() => onResolve(pending.id, 'accept', pending)}
                    className="flex-1 py-2 text-sm font-medium text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/40 transition-colors"
                  >
                    ✓ Confirmar
                  </button>
                  <div className="w-px bg-amber-200 dark:bg-amber-800" />
                  <button
                    onClick={() => onResolve(pending.id, 'reject', pending)}
                    className="flex-1 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
                  >
                    ✗ Descartar
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={i} className="rounded-md border p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ExerciseLightbox gif_url={ej.gif_url} nombre={ej.nombre} />
                  <span className="text-sm font-medium">{ej.nombre}</span>
                </div>
                <Badge variant="secondary" className="shrink-0 text-xs">
                  {ej.series}×{ej.repeticiones}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
                <span>Descanso: {ej.descanso_seg}s</span>
              </div>
              {ej.nota && (
                <div className="flex items-start gap-1.5 rounded-md bg-yellow-50 dark:bg-yellow-950/30 px-2.5 py-1.5 pl-6 text-xs text-yellow-800 dark:text-yellow-200">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{ej.nota}</span>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export function RoutineView({ routine }: { routine: PhysioRoutine }) {
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [localDias, setLocalDias] = useState<DraftDia[]>(routine.routine_data?.dias ?? []);

  useEffect(() => {
    setLocalDias(routine.routine_data?.dias ?? []);
  }, [routine.id, routine.routine_data]);

  useEffect(() => {
    if (!routine.id) return;
    fetch(`/api/gym/routines/pending-changes?routineId=${routine.id}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PendingChange[]) => setPendingChanges(data ?? []))
      .catch(() => {});
  }, [routine.id]);

  const handleResolve = async (changeId: string, action: 'accept' | 'reject', change: PendingChange) => {
    const res = await fetch('/api/gym/routines/pending-changes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pendingChangeId: changeId, action }),
    });

    if (!res.ok) return;

    if (action === 'accept') {
      setLocalDias((prev) =>
        prev.map((dia) => {
          if (dia.dia_index !== change.dia_index) return dia;
          return {
            ...dia,
            ejercicios: dia.ejercicios.map((ej) => {
              if (ej.exercise_id !== change.old_exercise_id) return ej;
              return {
                ...ej,
                exercise_id: change.new_exercise_id,
                nombre: change.new_exercise_nombre,
                gif_url: change.new_gif_url,
                nota: undefined,
              };
            }),
          };
        })
      );
    }

    setPendingChanges((prev) => prev.filter((c) => c.id !== changeId));
  };

  if (!routine.routine_data?.dias) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Esta rutina no tiene datos de ejercicios. Genera un nuevo plan.
        </p>
      </div>
    );
  }

  const { notas_generales } = routine.routine_data;

  return (
    <div className="space-y-4">
      {notas_generales && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Notas del plan</p>
          {notas_generales}
        </div>
      )}
      {pendingChanges.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {pendingChanges.length === 1
            ? '1 cambio sugerido por RodaAI pendiente de confirmación'
            : `${pendingChanges.length} cambios sugeridos por RodaAI pendientes de confirmación`}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {localDias.map((dia) => (
          <DayCard
            key={dia.dia_index}
            dia={dia}
            pendingChanges={pendingChanges}
            onResolve={handleResolve}
          />
        ))}
      </div>
    </div>
  );
}

export { equipoLabel };
