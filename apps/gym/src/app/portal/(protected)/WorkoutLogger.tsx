'use client';

import { useState, useEffect, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ExerciseLightbox } from '@/components/fisio/ExerciseLightbox';
import type { PhysioRoutine, DraftEjercicio, DraftDia } from '@/lib/fisio-types';

type SetKey = `${string}:${number}`;

interface SetState {
  reps: string;
  peso: string;
  nota: string;
  saved: boolean;
  saving: boolean;
}

interface SetLog {
  id: string;
  exercise_id: string;
  set_num: number;
  reps_o_seg: number;
  peso_kg: number | null;
  nota: string | null;
}

interface Session {
  id: string;
  dia_index: number;
  gym_set_logs: SetLog[];
}

interface PreviousBest {
  reps_o_seg: number;
  peso_kg: number | null;
  trained_at: string;
}

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function formatDateLabel(dateStr: string, today: string): string {
  if (dateStr === today) return 'Hoy';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
}

function isIsometric(ej: DraftEjercicio): boolean {
  return /^\d+\s*s(eg)?$/i.test(ej.repeticiones.trim());
}

function makeKey(exerciseId: string, setNum: number): SetKey {
  return `${exerciseId}:${setNum}`;
}

const DEFAULT_SET: SetState = { reps: '', peso: '', nota: '', saved: false, saving: false };

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
        nota: log.nota ?? '',
        saved: true,
        saving: false,
      };
    }
  }
  return { ids, sets };
}

export function WorkoutLogger({ routine }: { routine: PhysioRoutine }) {
  const dias: DraftDia[] = routine.routine_data.dias;
  const today = useMemo(() => getToday(), []);

  const [selectedDate, setSelectedDate] = useState(today);
  const [pastDates, setPastDates] = useState<string[]>([]);
  const [previousBest, setPreviousBest] = useState<Record<string, PreviousBest>>({});
  const [selectedDia, setSelectedDia] = useState(0);
  const [sessionIds, setSessionIds] = useState<Record<number, string>>({});
  const [sets, setSets] = useState<Record<SetKey, SetState>>({});
  const [loadingSession, setLoadingSession] = useState(true);

  const isToday = selectedDate === today;

  // All navigable dates: today + dates with sessions, deduped, desc
  const allDates = useMemo(() => {
    const set = new Set([today, ...pastDates]);
    return [...set].sort((a, b) => (b > a ? 1 : -1));
  }, [today, pastDates]);

  const currentIdx = allDates.indexOf(selectedDate);
  const canGoBack = currentIdx < allDates.length - 1;
  const canGoForward = currentIdx > 0;

  useEffect(() => {
    setLoadingSession(true);
    const url = `/api/gym/portal/sessions?routineId=${routine.id}&date=${selectedDate}`;
    fetch(url)
      .then((r) => (r.ok ? r.json() : { sessions: [], pastDates: [], previousBest: {} }))
      .then(({ sessions, pastDates: pd, previousBest: pb }: {
        sessions: Session[];
        pastDates: string[];
        previousBest: Record<string, PreviousBest>;
      }) => {
        const { ids, sets: savedSets } = logsToState(sessions);
        setSessionIds(ids);
        setSets(savedSets);
        setPastDates(pd);
        setPreviousBest(pb);
      })
      .catch(() => {})
      .finally(() => setLoadingSession(false));
  }, [routine.id, selectedDate]);

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

  function updateSet(key: SetKey, field: 'reps' | 'peso' | 'nota', value: string) {
    if (!isToday) return;
    setSets((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? DEFAULT_SET), [field]: value, saved: false },
    }));
  }

  async function handleSaveSet(ej: DraftEjercicio, setNum: number, diaIndex: number) {
    if (!isToday) return;
    const key = makeKey(ej.exercise_id, setNum);
    const current = sets[key] ?? DEFAULT_SET;
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
          nota: current.nota.trim() || null,
        }),
      });
      if (res.ok) {
        setSets((prev) => ({ ...prev, [key]: { ...current, reps: String(repsVal), saved: true, saving: false } }));
      } else {
        setSets((prev) => ({ ...prev, [key]: { ...current, saving: false } }));
      }
    } catch {
      setSets((prev) => ({ ...prev, [key]: { ...(sets[key] ?? DEFAULT_SET), saving: false } }));
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
      {/* Date navigator */}
      <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <button
          type="button"
          onClick={() => canGoBack && setSelectedDate(allDates[currentIdx + 1])}
          disabled={!canGoBack}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Anterior
        </button>

        <div className="flex flex-col items-center">
          <span className={`text-sm font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>
            {formatDateLabel(selectedDate, today)}
          </span>
          {!isToday && (
            <span className="text-[10px] text-muted-foreground">Solo lectura</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => canGoForward && setSelectedDate(allDates[currentIdx - 1])}
          disabled={!canGoForward}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-30"
        >
          Siguiente
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

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
            const hasTarget = !iso && ej.peso_objetivo_kg != null && ej.peso_objetivo_kg > 0;
            const prev = previousBest[ej.exercise_id];

            return (
              <div key={ej.exercise_id} className="rounded-lg border bg-card p-4 space-y-3">
                {/* Exercise header */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ExerciseLightbox gif_url={ej.gif_url} nombre={ej.nombre} />
                    <div>
                      <span className="text-sm font-medium">{ej.nombre}</span>
                      {hasTarget && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Objetivo: <span className="font-medium text-foreground">{ej.peso_objetivo_kg} kg</span> × {ej.repeticiones}
                        </p>
                      )}
                      {prev && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Última vez:{' '}
                          {!iso && prev.peso_kg != null && (
                            <span className="font-medium text-foreground">{prev.peso_kg} kg × </span>
                          )}
                          <span className="font-medium text-foreground">{prev.reps_o_seg} {repLabel}</span>
                          <span className="ml-1 text-[10px]">({formatDateLabel(prev.trained_at, today)})</span>
                        </p>
                      )}
                    </div>
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
                <div className="space-y-3 pt-1">
                  {Array.from({ length: ej.series }, (_, i) => i + 1).map((setNum) => {
                    const key = makeKey(ej.exercise_id, setNum);
                    const state = sets[key] ?? DEFAULT_SET;
                    return (
                      <div key={setNum} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground w-14 shrink-0">
                            Serie {setNum}
                          </span>
                          {!iso && (
                            <>
                              <input
                                type="number"
                                min="0"
                                step="0.5"
                                readOnly={!isToday}
                                value={state.peso}
                                onChange={(e) => updateSet(key, 'peso', e.target.value)}
                                placeholder={hasTarget ? String(ej.peso_objetivo_kg) : 'kg'}
                                className={`w-16 rounded-md border px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary bg-background ${!isToday ? 'opacity-60 cursor-default' : ''}`}
                              />
                              <span className="text-xs text-muted-foreground">×</span>
                            </>
                          )}
                          <input
                            type="number"
                            min="0"
                            readOnly={!isToday}
                            value={state.reps}
                            onChange={(e) => updateSet(key, 'reps', e.target.value)}
                            placeholder={repLabel}
                            className={`w-16 rounded-md border px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary bg-background ${!isToday ? 'opacity-60 cursor-default' : ''}`}
                          />
                          <span className="text-xs text-muted-foreground">{repLabel}</span>
                          {isToday ? (
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
                          ) : (
                            state.saved && (
                              <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Registrado
                              </span>
                            )
                          )}
                        </div>
                        {(isToday || state.nota) && (
                          <div className="pl-14">
                            <input
                              type="text"
                              readOnly={!isToday}
                              value={state.nota}
                              onChange={(e) => updateSet(key, 'nota', e.target.value)}
                              placeholder="Nota de esta serie (opcional)…"
                              className={`w-full rounded-md border px-2 py-1 text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50 ${!isToday ? 'opacity-60 cursor-default text-muted-foreground' : 'text-muted-foreground'}`}
                            />
                          </div>
                        )}
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
