'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { ExerciseLightbox } from '@/components/fisio/ExerciseLightbox';
import type { PhysioRoutine, DraftEjercicio, DraftDia } from '@/lib/fisio-types';

type SetKey = `${string}:${number}`;

interface SetState {
  reps: string;
  peso: string;
  saved: boolean;
  saving: boolean;
}

interface SetLog {
  id: string;
  exercise_id: string;
  set_num: number;
  reps_o_seg: number;
  peso_kg: number | null;
}

interface Session {
  id: string;
  dia_index: number;
  gym_set_logs: SetLog[];
}

function isIsometric(ej: DraftEjercicio): boolean {
  return /^\d+\s*s(eg)?$/i.test(ej.repeticiones.trim());
}

function makeKey(exerciseId: string, setNum: number): SetKey {
  return `${exerciseId}:${setNum}`;
}

function logsToState(sessions: Session[]): {
  ids: Record<number, string>;
  sets: Record<SetKey, SetState>;
} {
  const ids: Record<number, string> = {};
  const sets: Record<SetKey, SetState> = {};
  for (const session of sessions) {
    ids[session.dia_index] = session.id;
    for (const log of session.gym_set_logs) {
      sets[makeKey(log.exercise_id, log.set_num)] = {
        reps: String(log.reps_o_seg),
        peso: log.peso_kg != null ? String(log.peso_kg) : '',
        saved: true,
        saving: false,
      };
    }
  }
  return { ids, sets };
}

export function WorkoutLogger({ routine }: { routine: PhysioRoutine }) {
  const dias: DraftDia[] = routine.routine_data.dias;
  const [selectedDia, setSelectedDia] = useState(0);
  const [sessionIds, setSessionIds] = useState<Record<number, string>>({});
  const [sets, setSets] = useState<Record<SetKey, SetState>>({});
  const [loadingSession, setLoadingSession] = useState(true);

  useEffect(() => {
    fetch(`/api/gym/portal/sessions?routineId=${routine.id}`)
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then(({ sessions }: { sessions: Session[] }) => {
        const { ids, sets: savedSets } = logsToState(sessions);
        setSessionIds(ids);
        setSets(savedSets);
      })
      .catch(() => {})
      .finally(() => setLoadingSession(false));
  }, [routine.id]);

  async function ensureSession(diaIndex: number): Promise<string> {
    if (sessionIds[diaIndex]) return sessionIds[diaIndex];
    const res = await fetch('/api/gym/portal/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId: routine.id, diaIndex }),
    });
    const { sessionId } = await res.json();
    setSessionIds((prev) => ({ ...prev, [diaIndex]: sessionId }));
    return sessionId;
  }

  function updateSet(key: SetKey, field: 'reps' | 'peso', value: string) {
    setSets((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] ?? { reps: '', peso: '', saved: false, saving: false }),
        [field]: value,
        saved: false,
      },
    }));
  }

  async function handleSaveSet(ej: DraftEjercicio, setNum: number, diaIndex: number) {
    const key = makeKey(ej.exercise_id, setNum);
    const current = sets[key] ?? { reps: '', peso: '', saved: false, saving: false };
    const repsVal = parseInt(current.reps, 10);
    if (!repsVal || repsVal <= 0) return;

    setSets((prev) => ({ ...prev, [key]: { ...current, saving: true } }));
    try {
      const sessionId = await ensureSession(diaIndex);
      const iso = isIsometric(ej);
      const pesoKg = !iso && current.peso.trim() ? parseFloat(current.peso) : null;
      const res = await fetch('/api/gym/portal/set-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          exerciseId: ej.exercise_id,
          setNum,
          repsOSeg: repsVal,
          pesoKg,
        }),
      });
      if (res.ok) {
        setSets((prev) => ({ ...prev, [key]: { ...current, reps: String(repsVal), saved: true, saving: false } }));
      } else {
        setSets((prev) => ({ ...prev, [key]: { ...current, saving: false } }));
      }
    } catch {
      setSets((prev) => ({ ...prev, [key]: { ...current, saving: false } }));
    }
  }

  if (loadingSession) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const dia = dias[selectedDia];

  return (
    <div className="space-y-4">
      {/* Day tabs */}
      {dias.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dias.map((d, i) => (
            <button
              key={d.dia_index}
              type="button"
              onClick={() => setSelectedDia(i)}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors
                ${i === selectedDia
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted'
                }`}
            >
              {d.nombre}
            </button>
          ))}
        </div>
      )}

      {/* Exercises */}
      {dia && (
        <div className="space-y-4">
          {dia.ejercicios.map((ej) => {
            const iso = isIsometric(ej);
            const repLabel = iso ? 'seg' : 'reps';
            return (
              <div key={ej.exercise_id} className="rounded-lg border bg-card p-4 space-y-3">
                {/* Exercise header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ExerciseLightbox gif_url={ej.gif_url} nombre={ej.nombre} />
                    <span className="text-sm font-medium">{ej.nombre}</span>
                  </div>
                  <Badge variant="secondary" className="shrink-0 text-xs">
                    {ej.series}×{ej.repeticiones}
                  </Badge>
                </div>
                {ej.nota && (
                  <div className="flex items-start gap-1.5 rounded-md bg-yellow-50 dark:bg-yellow-950/30 px-2.5 py-1.5 text-xs text-yellow-800 dark:text-yellow-200">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>{ej.nota}</span>
                  </div>
                )}

                {/* Series rows */}
                <div className="space-y-2 pt-1">
                  {Array.from({ length: ej.series }, (_, i) => i + 1).map((setNum) => {
                    const key = makeKey(ej.exercise_id, setNum);
                    const state = sets[key] ?? { reps: '', peso: '', saved: false, saving: false };
                    return (
                      <div key={setNum} className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground w-14 shrink-0">
                          Serie {setNum}
                        </span>
                        {!iso && (
                          <>
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={state.peso}
                              onChange={(e) => updateSet(key, 'peso', e.target.value)}
                              placeholder="kg"
                              className="w-16 rounded-md border px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                            />
                            <span className="text-xs text-muted-foreground">×</span>
                          </>
                        )}
                        <input
                          type="number"
                          min="0"
                          value={state.reps}
                          onChange={(e) => updateSet(key, 'reps', e.target.value)}
                          placeholder={repLabel}
                          className="w-16 rounded-md border px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary bg-background"
                        />
                        <span className="text-xs text-muted-foreground">{repLabel}</span>
                        <button
                          type="button"
                          onClick={() => handleSaveSet(ej, setNum, dia.dia_index)}
                          disabled={state.saving || !state.reps}
                          className={`ml-auto shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50
                            ${state.saved
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-primary text-primary-foreground hover:bg-primary/90'
                            }`}
                        >
                          {state.saving ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : state.saved ? (
                            <>
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              Guardado
                            </>
                          ) : (
                            'Registrar'
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
