'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp, Dumbbell } from 'lucide-react';

interface SetLog {
  id: string;
  exercise_id: string;
  exercise_name: string;
  set_num: number;
  reps_o_seg: number;
  peso_kg: number | null;
}

interface TrainingSession {
  id: string;
  dia_index: number;
  dia_nombre: string;
  trained_at: string;
  set_logs: SetLog[];
}

function groupByExercise(logs: SetLog[]): Record<string, SetLog[]> {
  const groups: Record<string, SetLog[]> = {};
  for (const log of logs) {
    if (!groups[log.exercise_name]) groups[log.exercise_name] = [];
    groups[log.exercise_name].push(log);
  }
  return groups;
}

function formatSet(log: SetLog): string {
  if (log.peso_kg != null) return `${log.peso_kg}kg × ${log.reps_o_seg}`;
  return `${log.reps_o_seg}seg`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function ClientTrainingHistory({ clientId }: { clientId: string }) {
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch(`/api/gym/clients/${clientId}/training-history`)
      .then((r) => (r.ok ? r.json() : { sessions: [] }))
      .then(({ sessions: data }) => setSessions(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [clientId]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Dumbbell className="h-5 w-5" />
          Historial de entrenamiento
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-6">Cargando historial…</p>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aún no hay sesiones registradas por el cliente.
          </p>
        ) : (
          <div className="space-y-2">
            {sessions.map((session) => {
              const isOpen = expanded.has(session.id);
              const byExercise = groupByExercise(session.set_logs);
              return (
                <div key={session.id} className="rounded-lg border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleExpand(session.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 text-sm flex-wrap">
                      <span className="text-muted-foreground">{formatDate(session.trained_at)}</span>
                      <span className="font-medium">{session.dia_nombre}</span>
                      <span className="text-xs text-muted-foreground">
                        {session.set_logs.length} {session.set_logs.length === 1 ? 'serie' : 'series'}
                      </span>
                    </div>
                    {isOpen ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 pt-3 border-t space-y-3">
                      {Object.entries(byExercise).map(([name, logs]) => (
                        <div key={name}>
                          <p className="text-xs font-semibold text-muted-foreground mb-1.5">{name}</p>
                          <div className="flex flex-wrap gap-1.5">
                            {logs
                              .sort((a, b) => a.set_num - b.set_num)
                              .map((log) => (
                                <span
                                  key={log.id}
                                  className="text-xs rounded-md bg-muted px-2 py-1 font-mono"
                                >
                                  {formatSet(log)}
                                </span>
                              ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
