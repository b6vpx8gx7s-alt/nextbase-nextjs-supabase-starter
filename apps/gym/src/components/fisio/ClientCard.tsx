import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Calendar } from 'lucide-react';
import type { GymClient } from '@/lib/fisio-types';
import Link from 'next/link';

const nivelColor: Record<string, string> = {
  novato: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  intermedio: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  avanzado: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

export function ClientCard({ client }: { client: GymClient }) {
  const nivelClass = nivelColor[client.nivel_entrenamiento] ?? 'bg-secondary text-secondary-foreground';
  const createdDate = new Date(client.created_at).toLocaleDateString('es-CL');

  return (
    <Link href={`/clientes/${client.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardContent className="p-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{client.nombre}</p>
            <p className="text-sm text-muted-foreground truncate">{client.email ?? client.telefono ?? 'Sin contacto'}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${nivelClass}`}>
                {client.nivel_entrenamiento}
              </span>
              {client.objetivo_principal && (
                <Badge variant="outline" className="text-xs">
                  {client.objetivo_principal.replace('_', ' ')}
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <Calendar className="h-3 w-3" />
            {createdDate}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
