'use client';

import { useEffect, useState } from 'react';
import { ClientCard } from './ClientCard';
import { Button } from '@/components/ui/button';
import type { GymClient } from '@/lib/fisio-types';
import { Plus, Users } from 'lucide-react';
import Link from 'next/link';

export function ClientList() {
  const [clients, setClients] = useState<GymClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/gym/clients')
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((d) => setClients(d.clients ?? []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        Cargando clientes…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Error al cargar clientes: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}
          </span>
        </div>
        <Button asChild size="sm">
          <Link href="/clientes/new">
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Link>
        </Button>
      </div>

      {clients.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 gap-3 text-center">
          <Users className="h-10 w-10 text-muted-foreground" />
          <p className="font-medium">Sin clientes aún</p>
          <p className="text-sm text-muted-foreground">Agrega tu primer cliente para comenzar.</p>
          <Button asChild size="sm" className="mt-2">
            <Link href="/clientes/new">
              <Plus className="h-4 w-4" />
              Nuevo cliente
            </Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {clients.map((c) => (
            <ClientCard key={c.id} client={c} />
          ))}
        </div>
      )}
    </div>
  );
}
