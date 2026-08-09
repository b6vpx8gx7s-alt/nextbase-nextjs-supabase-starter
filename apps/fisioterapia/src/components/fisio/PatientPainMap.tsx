'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, X, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PainEntry {
  id: string;
  zona_corporal: string;
  mecanica: string;
  nivel: number;
  created_at?: string;
}

const ZONAS_SUGERIDAS = [
  'Lumbar', 'Cervical', 'Rodilla derecha', 'Rodilla izquierda',
  'Hombro derecho', 'Hombro izquierdo', 'Cadera derecha', 'Cadera izquierda',
  'Tobillo derecho', 'Tobillo izquierdo', 'Muñeca derecha', 'Muñeca izquierda',
  'Codo derecho', 'Codo izquierdo', 'Columna torácica', 'Pie', 'Mano',
];

function nivelVariant(nivel: number): 'destructive' | 'secondary' | 'outline' {
  if (nivel >= 7) return 'destructive';
  if (nivel >= 4) return 'secondary';
  return 'outline';
}

interface Props {
  clientId: string;
  initial: PainEntry[];
}

export function PatientPainMap({ clientId, initial }: Props) {
  const [entries, setEntries] = useState<PainEntry[]>(initial);
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [zona, setZona] = useState('');
  const [mecanica, setMecanica] = useState('');
  const [nivel, setNivel] = useState(5);
  const [saving, setSaving] = useState(false);

  const openModal = () => {
    setZona(''); setMecanica(''); setNivel(5);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!zona.trim() || !mecanica.trim()) {
      toast.error('Zona corporal y mecánica son requeridas');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/fisio/pain-map', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          zona_corporal: zona.trim(),
          mecanica: mecanica.trim(),
          nivel,
        }),
      });
      if (!res.ok) { const { error } = await res.json(); throw new Error(error); }
      const { entry } = await res.json();
      setEntries((prev) => [entry, ...prev]);
      toast.success('Zona de dolor agregada');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta zona de dolor?')) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/fisio/pain-map/${id}`, { method: 'DELETE' });
      if (!res.ok) { const { error } = await res.json(); throw new Error(error); }
      setEntries((prev) => prev.filter((e) => e.id !== id));
      toast.success('Zona de dolor eliminada');
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
              <AlertTriangle className="h-4 w-4" />
              Zonas de dolor
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openModal} className="h-7 px-2 text-xs">
              <Plus className="h-3 w-3" />
              Agregar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguna registrada</p>
          ) : (
            <ul className="space-y-2">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 group">
                  <span className="text-sm min-w-0">
                    {e.zona_corporal}
                    <span className="text-muted-foreground"> — {e.mecanica}</span>
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={nivelVariant(e.nivel)} className="ml-2 text-xs">
                      {e.nivel}/10
                    </Badge>
                    <button
                      onClick={() => handleDelete(e.id)}
                      disabled={deleting === e.id}
                      className="rounded p-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive transition-opacity"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
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
              <h2 className="text-base font-semibold">Agregar zona de dolor</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Zona corporal *
                </label>
                <input
                  type="text"
                  list="zonas-dolor-list"
                  value={zona}
                  onChange={(e) => setZona(e.target.value)}
                  placeholder="Ej: Rodilla derecha"
                  autoFocus
                  className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <datalist id="zonas-dolor-list">
                  {ZONAS_SUGERIDAS.map((z) => <option key={z} value={z} />)}
                </datalist>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Mecánica del dolor *
                </label>
                <input
                  type="text"
                  value={mecanica}
                  onChange={(e) => setMecanica(e.target.value)}
                  placeholder="Ej: al flexionar, en reposo, al subir escaleras"
                  className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Nivel de dolor: <span className="text-foreground font-semibold">{nivel}/10</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={nivel}
                  onChange={(e) => setNivel(Number(e.target.value))}
                  className="w-full accent-primary"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                  <span>1 Leve</span>
                  <span>5 Moderado</span>
                  <span>10 Severo</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving || !zona.trim() || !mecanica.trim()}>
                {saving ? 'Guardando…' : 'Agregar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
