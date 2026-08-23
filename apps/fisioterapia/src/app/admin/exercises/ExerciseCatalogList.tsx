'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { ExerciseThumb } from '@/components/fisio/ExerciseThumb';
import { ExerciseLightbox } from '@/components/fisio/ExerciseLightbox';
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
  gif_url: string | null;
};

const MUSCLE_GROUPS = ['pecho', 'hombros', 'espalda', 'piernas', 'gluteos', 'core', 'cardio', 'movilidad'];

async function uploadExerciseFile(file: File): Promise<string> {
  const urlRes = await fetch('/api/fisio/exercises/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filename: file.name, contentType: file.type }),
  });
  if (!urlRes.ok) {
    const { error } = await urlRes.json();
    throw new Error(error ?? 'Error al obtener URL de subida');
  }
  const { signedUrl, publicUrl } = await urlRes.json();
  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploadRes.ok) throw new Error('Error al subir imagen a Storage');
  return publicUrl as string;
}

export function ExerciseCatalogList() {
  const [exercises, setExercises] = useState<CatalogExercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const [editTarget, setEditTarget] = useState<CatalogExercise | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft>({ nombre: '', grupo_muscular: 'core', descripcion_breve: '', gif_url: null });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CatalogExercise | null>(null);
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string | null>(null);
  const [uploadingGif, setUploadingGif] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      gif_url: ex.gif_url,
    });
    setGifPreviewUrl(null);
  };

  const cancelEdit = () => {
    if (gifPreviewUrl) URL.revokeObjectURL(gifPreviewUrl);
    setGifPreviewUrl(null);
    setUploadingGif(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
    setEditTarget(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'video/mp4') { toast.error('Solo se aceptan imágenes, GIFs o video MP4'); return; }
    if (file.size > 28 * 1024 * 1024) { toast.error('El archivo no puede superar 28 MB'); return; }

    if (gifPreviewUrl) URL.revokeObjectURL(gifPreviewUrl);
    const localUrl = URL.createObjectURL(file);
    setGifPreviewUrl(localUrl);
    setUploadingGif(true);
    try {
      const publicUrl = await uploadExerciseFile(file);
      setEditDraft((d) => ({ ...d, gif_url: publicUrl }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir imagen');
      URL.revokeObjectURL(localUrl);
      setGifPreviewUrl(null);
      setEditDraft((d) => ({ ...d, gif_url: editTarget?.gif_url ?? null }));
    } finally {
      setUploadingGif(false);
    }
  };

  const clearNewGif = () => {
    if (gifPreviewUrl) URL.revokeObjectURL(gifPreviewUrl);
    setGifPreviewUrl(null);
    setEditDraft((d) => ({ ...d, gif_url: editTarget?.gif_url ?? null }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    if (!editDraft.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        nombre: editDraft.nombre.trim(),
        grupo_muscular: editDraft.grupo_muscular,
        descripcion_breve: editDraft.descripcion_breve.trim() || null,
      };
      if (editDraft.gif_url !== editTarget.gif_url) {
        body.gif_url = editDraft.gif_url ?? '';
      }

      const res = await fetch(`/api/fisio/exercises/${editTarget.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error');
      }

      const updatedGifUrl = editDraft.gif_url;
      setExercises((prev) =>
        prev.map((ex) =>
          ex.id === editTarget.id
            ? { ...ex, nombre: editDraft.nombre.trim(), grupo_muscular: editDraft.grupo_muscular, descripcion_breve: editDraft.descripcion_breve.trim() || null, gif_url: updatedGifUrl }
            : ex
        )
      );
      toast.success('Ejercicio actualizado');
      if (gifPreviewUrl) URL.revokeObjectURL(gifPreviewUrl);
      setGifPreviewUrl(null);
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
              <ExerciseLightbox gif_url={ex.gif_url} nombre={ex.nombre} className="h-10 w-10 shrink-0" />
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
              <button onClick={cancelEdit} className="rounded-md p-1 hover:bg-muted">
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

              {/* Image upload */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">Imagen / GIF</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/gif,image/*,video/mp4"
                  className="sr-only"
                  onChange={handleFileSelect}
                  disabled={uploadingGif}
                />
                {gifPreviewUrl ? (
                  <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                    <ExerciseThumb gif_url={gifPreviewUrl} className="h-12 w-12 shrink-0" />
                    <span className="flex-1 text-xs text-muted-foreground">
                      {uploadingGif ? 'Subiendo…' : 'Lista para guardar'}
                    </span>
                    <button
                      type="button"
                      onClick={clearNewGif}
                      disabled={uploadingGif}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                    <ExerciseThumb gif_url={editDraft.gif_url} className="h-12 w-12 shrink-0" />
                    <div className="flex flex-col gap-1">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs text-primary hover:underline text-left"
                      >
                        {editDraft.gif_url ? 'Cambiar imagen' : 'Agregar imagen'}
                      </button>
                      {editDraft.gif_url && (
                        <button
                          type="button"
                          onClick={() => setEditDraft((d) => ({ ...d, gif_url: null }))}
                          className="text-xs text-destructive hover:underline text-left"
                        >
                          Quitar imagen
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                onClick={cancelEdit}
                disabled={saving}
                className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || uploadingGif}
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
