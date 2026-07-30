'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { updateBusinessCategoryAction, type BusinessCategory, type BusinessRow } from '@/data/admin/businesses';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Building2 } from 'lucide-react';

const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  tatuaje: 'Tatuaje',
  barberia: 'Barbería',
  spa: 'Spa',
  nutricion: 'Nutrición',
  otro: 'Otro',
};

const CATEGORY_OPTIONS: BusinessCategory[] = ['tatuaje', 'barberia', 'spa', 'nutricion', 'otro'];

function BusinessCategoryRow({ business }: { business: BusinessRow }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(category: string) {
    startTransition(async () => {
      const fd = new FormData();
      fd.append('businessId', business.id);
      fd.append('category', category);
      try {
        await updateBusinessCategoryAction(fd);
        toast.success(`Categoría actualizada para ${business.name}`);
      } catch {
        toast.error('Error al actualizar la categoría');
      }
    });
  }

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="flex items-center gap-3 min-w-0">
        <Building2 className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate font-medium text-sm">{business.name}</p>
          <p className="truncate text-xs text-muted-foreground">/{business.slug}</p>
        </div>
        {!business.active && (
          <Badge variant="secondary" className="shrink-0">Inactivo</Badge>
        )}
      </div>
      <Select
        defaultValue={business.category ?? undefined}
        onValueChange={handleChange}
        disabled={isPending}
      >
        <SelectTrigger className="w-36 shrink-0">
          <SelectValue placeholder="Sin categoría" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORY_OPTIONS.map((cat) => (
            <SelectItem key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AdminMasterClient({ businesses }: { businesses: BusinessRow[] }) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Admin Master</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestión de negocios — {businesses.length} negocios registrados
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Categoría del negocio</CardTitle>
          <CardDescription>
            Asigna la categoría de cada negocio para personalizar su experiencia.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {businesses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No hay negocios registrados.
            </p>
          ) : (
            businesses.map((b) => (
              <BusinessCategoryRow key={b.id} business={b} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
