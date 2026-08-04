'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { GenerateRoutineButton } from '@/components/fisio/GenerateRoutineButton';
import { RoutineView } from '@/components/fisio/RoutineView';
import type { PhysioClient, Pathology, PainEntry, PhysioRoutine } from '@/lib/fisio-types';
import { ChevronLeft, AlertTriangle, Activity, ClipboardList } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface ClientDetail {
  client: PhysioClient;
  pathologies: Pathology[];
  pain_map: (PainEntry & { id: string; created_at: string })[];
  routines: PhysioRoutine[];
}

const nivelColor: Record<string, string> = {
  principiante: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  intermedio: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  avanzado: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [detail, setDetail] = useState<ClientDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeRoutine, setActiveRoutine] = useState<PhysioRoutine | null>(null);

  useEffect(() => {
    fetch(`/api/fisio/clients/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d: ClientDetail) => {
        setDetail(d);
        setActiveRoutine(d.routines[0] ?? null);
      })
      .catch(() => toast.error('Error al cargar el paciente'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este paciente? Esta acción no se puede deshacer.')) return;
    const res = await fetch(`/api/fisio/clients/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Paciente eliminado');
      router.push('/dashboard');
    } else {
      toast.error('Error al eliminar');
    }
  };

  if (loading) {
    return (
      <div className="p-6 text-center text-muted-foreground">Cargando paciente…</div>
    );
  }

  if (!detail) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">Paciente no encontrado.</p>
        <Link href="/dashboard" className="text-sm text-primary mt-2 inline-block">
          Volver al dashboard
        </Link>
      </div>
    );
  }

  const { client, pathologies, pain_map, routines } = detail;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Back */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver al dashboard
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{client.nombre}</h1>
          <div className="mt-2 flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${nivelColor[client.nivel_fisico] ?? ''}`}>
              {client.nivel_fisico}
            </span>
            <Badge variant="outline" className="text-xs">
              {client.objetivo.replace('_', ' ')}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {client.dias_disponibles.length} día{client.dias_disponibles.length !== 1 ? 's' : ''}/semana
            </span>
          </div>
          {(client.email || client.telefono) && (
            <p className="text-sm text-muted-foreground mt-1">
              {client.email}{client.email && client.telefono ? ' · ' : ''}{client.telefono}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={handleDelete} className="text-destructive hover:text-destructive shrink-0">
          Eliminar
        </Button>
      </div>

      {/* Info clínica */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Patologías
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pathologies.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguna registrada</p>
            ) : (
              <ul className="space-y-2">
                {pathologies.map((p) => (
                  <li key={p.id} className="text-sm">
                    <span className="font-medium">{p.nombre}</span>
                    <span className="text-muted-foreground"> — {p.zona_corporal}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4" />
              Zonas de dolor
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pain_map.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ninguna registrada</p>
            ) : (
              <ul className="space-y-2">
                {pain_map.map((p, i) => (
                  <li key={i} className="flex items-center justify-between text-sm">
                    <span>{p.zona_corporal} — {p.mecanica}</span>
                    <Badge
                      variant={p.nivel >= 7 ? 'destructive' : p.nivel >= 4 ? 'secondary' : 'outline'}
                      className="ml-2"
                    >
                      {p.nivel}/10
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan actual */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Plan de ejercicios
              </CardTitle>
              {activeRoutine ? (
                <CardDescription>
                  Semana {activeRoutine.semana}/{activeRoutine.year} · generado el{' '}
                  {new Date(activeRoutine.generated_at).toLocaleDateString('es-CL')}
                </CardDescription>
              ) : (
                <CardDescription>Sin plan generado aún</CardDescription>
              )}
            </div>
            <GenerateRoutineButton
              clientId={id}
              onGenerated={(r) => {
                setActiveRoutine(r);
                setDetail((prev) =>
                  prev ? { ...prev, routines: [r, ...prev.routines] } : prev
                );
              }}
            />
          </div>
        </CardHeader>
        <CardContent>
          {activeRoutine ? (
            <>
              {routines.length > 1 && (
                <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                  {routines.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setActiveRoutine(r)}
                      className={`shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors
                        ${r.id === activeRoutine.id
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'hover:bg-muted'
                        }`}
                    >
                      S{r.semana}/{r.year}
                    </button>
                  ))}
                </div>
              )}
              <RoutineView routine={activeRoutine} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <Activity className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Sin plan de ejercicios</p>
              <p className="text-sm text-muted-foreground">
                Genera un plan personalizado con IA basado en el perfil del paciente.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
