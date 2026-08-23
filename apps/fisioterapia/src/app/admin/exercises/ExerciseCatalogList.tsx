'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ExerciseThumb } from '@/components/fisio/ExerciseThumb';
import { X } from 'lucide-react';

type CatalogExercise = {
  id: string;
  nombre: string;
  grupo_muscular: string;
  descripcion_breve: string | null;
  gif_url: string | null;
};

type EditDraft = {
  nombre: string;
  grupo_muscular: string;
  descripcion_breve: string;
};

const MUSCLE_GROUPS = ['pecho', 'hombros', 'espalda', 'piernas', 'gluteos', 'core', 'cardio', 'movilidad'];

export function ExerciseCatalogList() {
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [editTarget, setEditTarget] = useState<CatalogExercise | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ nombre: '', grupo_muscular: 'core', descripcion_breve: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CatalogExercise | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchExercises = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const url = q.length >= 2
        ? `/api/fisio/exercises/catalog?search=${encodeURIComponent(q)}`
        : '/api/fisio/exercises/catalog';
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const { exercises: list } = await res.json() as { exercises: CatalogExercise[] };
      setExercises(list);
    } catch {
      toast.error('Error al cargar el catálogo');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExercises('');
  }, [fetchExercises]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchExercises(value), 350);
  };

  const openEdit = (ex: CatalogExercise) => {
    setEditTarget(ex);
    setEditDraft({
      nombre: ex.nombre,
      grupo_muscular: ex.grupo_muscular,
      descripcion_breve: ex.descripcion_breve ?? '',
    });
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editDraft.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/fisio/exercises/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: editDraft.nombre.trim(),
          grupo_muscular: editDraft.grupo_muscular,
          descripcion_breve: editDraft.descripcion_breve.trim() || null,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error');
      }
      setExercises((prev) =>
        prev.map((ex) =>
          ex.id === editTarget.id
            ? { ...ex, nombre: editDraft.nombre.trim(), grupo_muscular: editDraft.grupo_muscular, descripcion_breve: editDraft.descripcion_breve.trim() || null }
            : ex
        )
      );
      toast.success('Ejercicio actualizado');
      setEditTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (ex: CatalogExercise) => {
    setPending((p) => ({ ...p, [ex.id]: true }));
    setConfirmDelete(null);
    try {
      const res = await fetch(`/api/fisio/exercises/${ex.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error');
      }
      setExercises((prev) => prev.filter((e) => e.id !== ex.id));
      toast.success(`"${ex.nombre}" eliminado`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setPending((p) => ({ ...p, [ex.id]: false }));
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder="Buscar ejercicio…"
        className="w-full max-w-sm rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {loading ? (
        <p className="text-sm text-muted-foreground py-6">Cargando catálogo…</p>
      ) : exercises.length === 0 ? (
        <div className="rounded-lg border border-dashed px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">Sin resultados.</p>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {exercises.map((ex) => (
            <div key={ex.id} className="flex items-center gap-4 px-4 py-3">
              <ExerciseThumb gif_url={ex.gif_url} className="h-10 w-10 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{ex.nombre}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {ex.grupo_muscular}
                  {ex.descripcion_breve && (
                    <span className="ml-2 text-muted-foreground/70">· {ex.descripcion_breve}</span>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  onClick={() => openEdit(ex)}
                  disabled={pending[ex.id]}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
                >
                  Editar
                </button>
                <button
                  onClick={() => setConfirmDelete(ex)}
                  disabled={pending[ex.id]}
                  className="rounded-md border border-destructive/40 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                >
                  {pending[ex.id] ? 'Eliminando…' : 'Eliminar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-base font-semibold">Editar ejercicio</h2>
              <button onClick={() => setEditTarget(null)} className="rounded-md p-1 hover:bg-muted">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">Nombre *</label>
                <input
                  type="text"
                  value={editDraft.nombre}
                  onChange={(e) => setEditDraft((d) => ({ ...d, nombre: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">Grupo muscular *</label>
                <select
                  value={editDraft.grupo_muscular}
                  onChange={(e) => setEditDraft((d) => ({ ...d, grupo_muscular: e.target.value }))}
                  className="w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary capitalize"
                >
                  {MUSCLE_GROUPS.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">Descripción breve</label>
                <input
                  type="text"
                  value={editDraft.descripcion_breve}
                  onChange={(e) => setEditDraft((d) => ({ ...d, descripcion_breve: e.target.value }))}
                  placeholder="Opcional"
                  className="w-full rounded-md border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                onClick={() => setEditTarget(null)}
                disabled={saving}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-background shadow-xl p-6 space-y-4">
            <p className="text-sm font-medium">¿Eliminar "{confirmDelete.nombre}"?</p>
            <p className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer. Si el ejercicio está en uso en rutinas activas, la eliminación será bloqueada.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmDelete(null)}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
