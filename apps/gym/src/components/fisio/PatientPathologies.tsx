'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ClipboardList, X, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Pathology {
  id: string;
  nombre: string;
  zona_corporal: string;
  fecha_diagnostico?: string | null;
  notas?: string | null;
  created_at?: string;
}

const ZONAS_SUGERIDAS = [
  'Lumbar', 'Cervical', 'Rodilla derecha', 'Rodilla izquierda',
  'Hombro derecho', 'Hombro izquierdo', 'Cadera derecha', 'Cadera izquierda',
  'Tobillo derecho', 'Tobillo izquierdo', 'Muñeca derecha', 'Muñeca izquierda',
  'Codo derecho', 'Codo izquierdo', 'Columna torácica', 'Pie', 'Mano',
];

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

interface Props {
  clientId: string;
  initial: Pathology[];
}

export function PatientPathologies({ clientId, initial }: Props) {
  const [pathologies, setPathologies] = useState<Pathology[]>(initial);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [nombre, setNombre] = useState('');
  const [zona, setZona] = useState('');
  const [fecha, setFecha] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);

  const openModal = () => {
    setNombre(''); setZona(''); setFecha(''); setNotas('');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!nombre.trim() || !zona.trim()) {
      toast.error('Nombre y zona corporal son requeridos');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/fisio/pathologies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          nombre: nombre.trim(),
          zona_corporal: zona.trim(),
          fecha_diagnostico: fecha || null,
          notas: notas.trim() || null,
        }),
      });
      if (!res.ok) { const { error } = await res.json(); throw new Error(error); }
      const { pathology } = await res.json();
      setPathologies((prev) => [...prev, pathology]);
      toast.success('Patología agregada');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta patología?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/fisio/pathologies/${id}`, { method: 'DELETE' });
      if (!res.ok) { const { error } = await res.json(); throw new Error(error); }
      setPathologies((prev) => prev.filter((p) => p.id !== id));
      toast.success('Patología eliminada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4" />
              Patologías
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openModal} className="h-7 px-2 text-xs">
              <Plus className="h-3 w-3" />
              Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {pathologies.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguna registrada</p>
          ) : (
            <ul className="space-y-2">
              {pathologies.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-2 group">
                  <div className="min-w-0">
                    <span className="text-sm font-medium">{p.nombre}</span>
                    <span className="text-muted-foreground text-sm"> — {p.zona_corporal}</span>
                    {p.fecha_diagnostico && (
                      <span className="block text-xs text-muted-foreground">
                        Diagnóstico: {formatDate(p.fecha_diagnostico)}
                      </span>
                    )}
                    {p.notas && (
                      <span className="block text-xs text-muted-foreground">{p.notas}</span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    disabled={deleting === p.id}
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Agregar patología</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Nombre *
                </label>
                <input
                  type="text"
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="Ej: Hernia discal L4-L5"
                  autoFocus
                  className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Zona corporal *
                </label>
                <input
                  type="text"
                  list="zonas-list"
                  value={zona}
                  onChange={(e) => setZona(e.target.value)}
                  placeholder="Ej: Lumbar"
                  className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <datalist id="zonas-list">
                  {ZONAS_SUGERIDAS.map((z) => <option key={z} value={z} />)}
                </datalist>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Fecha de diagnóstico (opcional)
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Notas (opcional)
                </label>
                <input
                  type="text"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Observaciones…"
                  className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !nombre.trim() || !zona.trim()}>
                {saving ? 'Guardando…' : 'Agregar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
