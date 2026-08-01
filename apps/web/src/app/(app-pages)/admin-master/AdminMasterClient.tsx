'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { updateBusinessCategoryAction, type BusinessCategory, type BusinessRow } from '@/data/admin/businesses';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const CATEGORY_LABELS: Record<BusinessCategory, string> = {
  tatuaje: 'Tatuaje',
  barberia: 'Barbería',
  spa: 'Spa',
  nutricion: 'Nutrición',
  otro: 'Otro',
};

const CATEGORY_OPTIONS: BusinessCategory[] = ['tatuaje', 'barberia', 'spa', 'nutricion', 'otro'];

function CategoryCell({ business }: { business: BusinessRow }) {
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
    <Select
      defaultValue={business.category ?? undefined}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="w-36 h-8 text-xs">
        <SelectValue placeholder="Sin categoría" />
      </SelectTrigger>
      <SelectContent>
        {CATEGORY_OPTIONS.map((cat) => (
          <SelectItem key={cat} value={cat} className="text-xs">
            {CATEGORY_LABELS[cat]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AdminMasterClient({ businesses }: { businesses: BusinessRow[] }) {
  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold">Admin Master</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestión de negocios — {businesses.length} negocios registrados
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Negocios</CardTitle>
          <CardDescription>
            Consulta y edita la categoría de cada negocio registrado.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Negocio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {businesses.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No hay negocios registrados.
                    </TableCell>
                  </TableRow>
                ) : (
                  businesses.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <p className="font-medium text-sm">{b.name}</p>
                        <p className="text-xs text-muted-foreground">/{b.slug}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.active ? 'default' : 'secondary'}>
                          {b.active ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <CategoryCell business={b} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {b.plan ?? '—'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
