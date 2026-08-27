'use client';

import { useState, useCallback, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { X, ChevronDown, ChevronRight, Pencil, Plus, Camera, Search } from 'lucide-react';
import { ExerciseThumb } from '@/components/fisio/ExerciseThumb';
import type { PhysioRoutine, ExerciseWithFlags, DraftDia, DraftEjercicio } from '@/lib/fisio-types';
import toast from 'react-hot-toast';

const DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const MUSCLE_GROUPS = ['pecho', 'hombros', 'espalda', 'piernas', 'gluteos', 'core', 'cardio', 'movilidad'];
const SHORT_DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

async function uploadExerciseFile(file: File): Promise<string> {
  const urlRes = await fetch('/api/gym/exercises/upload-url', {
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

interface Props {
  clientId: string;
  clientDiasDisponibles: number[];
  onCreated?: (routine: PhysioRoutine) => void;
  mode?: 'create' | 'edit';
  existingRoutine?: PhysioRoutine;
  onUpdated?: (routine: PhysioRoutine) => void;
}

type ExerciseParams = { series: number; repeticiones: string; notas: string };
// dayIndex (0–6) → exerciseId → params
type DayMap = Record<number, Record<string, ExerciseParams>>;

export function ManualRoutineBuilder({
  clientId,
  clientDiasDisponibles,
  onCreated,
  mode = 'create',
  existingRoutine,
  onUpdated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [exercises, setExercises] = useState<ExerciseWithFlags[]>([]);
  const [loadingEx, setLoadingEx] = useState(false);
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [activeTab, setActiveTab] = useState(0); // index into selectedDays
  const [dayMap, setDayMap] = useState<DayMap>({});
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customDraft, setCustomDraft] = useState({ nombre: '', grupo_muscular: 'core', descripcion_breve: '', gif_url: '' });
  const [savingCustom, setSavingCustom] = useState(false);
  const [suggestPrompt, setSuggestPrompt] = useState<{ id: string; nombre: string } | null>(null);
  const [uploadingGif, setUploadingGif] = useState(false);
  const [gifPreviewUrl, setGifPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replacingGifForRef = useRef<string | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const openModal = useCallback(async () => {
    if (mode === 'edit' && existingRoutine) {
      console.log('[ManualRoutineBuilder] edit mode — existingRoutine.id:', existingRoutine.id);
      console.log('[ManualRoutineBuilder] routine_data:', JSON.stringify(existingRoutine.routine_data));

      const dias = existingRoutine.routine_data?.dias ?? [];
      const days = dias
        .map((dia) => DAYS.indexOf(dia.nombre))
        .filter((i) => i >= 0)
        .sort((a, b) => a - b);

      console.log('[ManualRoutineBuilder] dia nombres:', dias.map((d) => d.nombre));
      console.log('[ManualRoutineBuilder] resolved selectedDays:', days);

      // If no days resolved (e.g. AI routine with non-Spanish names), fall back
      // to client's configured days so the user can at least re-assign.
      const resolvedDays = days.length > 0 ? days : [...clientDiasDisponibles].sort((a, b) => a - b);
      setSelectedDays(resolvedDays);

      const initialDayMap: DayMap = {};
      dias.forEach((dia, seqIdx) => {
        // Primary: match by day name. Fallback: use position within resolvedDays.
        const dayIdx = DAYS.indexOf(dia.nombre) >= 0
          ? DAYS.indexOf(dia.nombre)
          : resolvedDays[seqIdx] ?? -1;
        if (dayIdx < 0) return;
        initialDayMap[dayIdx] = {};
        dia.ejercicios.forEach((ej) => {
          if (!ej.exercise_id) return; // skip exercises with missing IDs (e.g. AI-generated without linking)
          initialDayMap[dayIdx][ej.exercise_id] = {
            series: ej.series,
            repeticiones: ej.repeticiones,
            notas: ej.nota ?? '',
          };
        });
      });

      console.log('[ManualRoutineBuilder] initialDayMap full:', JSON.stringify(initialDayMap));
      setDayMap(initialDayMap);
      setStep(2); // skip day picker — go straight to exercise builder
    } else {
      setSelectedDays([...clientDiasDisponibles].sort((a, b) => a - b));
      setDayMap({});
      setStep(1);
    }
    setActiveTab(0);
    setSearchQuery('');
    setOpen(true);

    setLoadingEx(true);
    try {
      const res = await fetch(`/api/gym/exercises?client_id=${clientId}`);
      if (!res.ok) throw new Error('Error al cargar ejercicios');
      const { exercises: list } = await res.json() as { exercises: ExerciseWithFlags[] };
      setExercises(list);
      // Collapse all groups by default; user expands as needed
      const groups = [...new Set(list.map((e) => e.grupo_muscular))];
      const init: Record<string, boolean> = {};
      groups.forEach((g) => { init[g] = false; });
      // Expand the first group automatically
      if (groups[0]) init[groups[0]] = true;
      setExpandedGroups(init);
    } catch {
      toast.error('Error al cargar el catálogo de ejercicios');
    } finally {
      setLoadingEx(false);
    }
  }, [clientId, clientDiasDisponibles, mode, existingRoutine]);

  const toggleDay = (dayIdx: number) => {
    setSelectedDays((prev) => {
      if (prev.includes(dayIdx)) {
        setDayMap((dm) => { const next = { ...dm }; delete next[dayIdx]; return next; });
        return prev.filter((d) => d !== dayIdx);
      }
      return [...prev, dayIdx].sort((a, b) => a - b);
    });
  };

  const toggleExercise = (dayIdx: number, ex: ExerciseWithFlags) => {
    setDayMap((prev) => {
      const cur = { ...(prev[dayIdx] ?? {}) };
      if (cur[ex.id]) {
        delete cur[ex.id];
      } else {
        cur[ex.id] = { series: 3, repeticiones: '10-12', notas: '' };
      }
      return { ...prev, [dayIdx]: cur };
    });
  };

  const updateParam = (
    dayIdx: number,
    exId: string,
    field: keyof ExerciseParams,
    value: string | number
  ) => {
    setDayMap((prev) => ({
      ...prev,
      [dayIdx]: {
        ...(prev[dayIdx] ?? {}),
        [exId]: {
          ...(prev[dayIdx]?.[exId] ?? { series: 3, repeticiones: '10-12', notas: '' }),
          [field]: value,
        },
      },
    }));
  };

  const toggleGroup = (group: string) =>
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));

  const handleReplaceGif = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const exId = replacingGifForRef.current;
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
    replacingGifForRef.current = null;
    if (!file || !exId) return;
    if (!file.type.startsWith('image/') && file.type !== 'video/mp4') { toast.error('Solo se aceptan imágenes o video MP4'); return; }
    if (file.size > 28 * 1024 * 1024) { toast.error('El archivo no puede superar 28 MB'); return; }

    const toastId = toast.loading('Actualizando imagen…');
    try {
      const url = await uploadExerciseFile(file);

      const patchRes = await fetch(`/api/gym/exercises/${exId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gif_url: url }),
      });
      if (!patchRes.ok) { const { error } = await patchRes.json(); throw new Error(error ?? 'Error al actualizar'); }

      setExercises((prev) => prev.map((ex) => ex.id === exId ? { ...ex, gif_url: url } : ex));
      toast.success('Imagen actualizada', { id: toastId });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado', { id: toastId });
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/') && file.type !== 'video/mp4') { toast.error('Solo se aceptan imágenes, GIFs o video MP4'); return; }
    if (file.size > 28 * 1024 * 1024) { toast.error('El archivo no puede superar 28 MB'); return; }

    const localUrl = URL.createObjectURL(file);
    setGifPreviewUrl(localUrl);
    setUploadingGif(true);
    try {
      const url = await uploadExerciseFile(file);
      setCustomDraft((d) => ({ ...d, gif_url: url }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir imagen');
      URL.revokeObjectURL(localUrl);
      setGifPreviewUrl(null);
      setCustomDraft((d) => ({ ...d, gif_url: '' }));
      if (fileInputRef.current) fileInputRef.current.value = '';
    } finally {
      setUploadingGif(false);
    }
  };

  const cancelCustomForm = () => {
    if (gifPreviewUrl) URL.revokeObjectURL(gifPreviewUrl);
    setGifPreviewUrl(null);
    setShowCustomForm(false);
    setCustomDraft({ nombre: '', grupo_muscular: 'core', descripcion_breve: '', gif_url: '' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleAddCustom = async () => {
    if (!customDraft.nombre.trim()) { toast.error('El nombre es requerido'); return; }
    setSavingCustom(true);
    try {
      const res = await fetch('/api/gym/exercises/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customDraft),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error al crear ejercicio');
      }
      const { exercise } = await res.json();
      const newEx: ExerciseWithFlags = { ...exercise, forbidden: false, caution_notes: [] };
      setExercises((prev) => [...prev, newEx]);
      setExpandedGroups((prev) => ({ ...prev, [exercise.grupo_muscular]: true }));
      // Auto-select for active day
      setDayMap((prev) => ({
        ...prev,
        [activeDayIdx]: {
          ...(prev[activeDayIdx] ?? {}),
          [exercise.id]: { series: 3, repeticiones: '10-12', notas: '' },
        },
      }));
      if (gifPreviewUrl) URL.revokeObjectURL(gifPreviewUrl);
      setGifPreviewUrl(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setCustomDraft({ nombre: '', grupo_muscular: 'core', descripcion_breve: '', gif_url: '' });
      setShowCustomForm(false);
      toast.success(`"${exercise.nombre}" agregado`);
      setSuggestPrompt({ id: exercise.id, nombre: exercise.nombre });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSavingCustom(false);
    }
  };

  const handleSuggest = async () => {
    if (!suggestPrompt) return;
    const { id, nombre } = suggestPrompt;
    setSuggestPrompt(null);
    try {
      const res = await fetch(`/api/gym/exercises/${id}/suggest`, { method: 'PATCH' });
      if (!res.ok) throw new Error();
      toast.success(`"${nombre}" sugerido para el catálogo público`);
    } catch {
      toast.error('No se pudo enviar la sugerencia');
    }
  };

  const handleSubmit = async () => {
    console.log('[ManualRoutineBuilder] handleSubmit — selectedDays:', selectedDays);
    console.log('[ManualRoutineBuilder] handleSubmit — dayMap:', JSON.stringify(dayMap));
    console.log('[ManualRoutineBuilder] handleSubmit — exercises loaded:', exercises.length);

    setSubmitting(true);
    try {
      const dias: DraftDia[] = selectedDays.map((dayIdx, i) => {
        const exEntries = Object.entries(dayMap[dayIdx] ?? {});
        const ejercicios: DraftEjercicio[] = exEntries.flatMap(([exId, params]) => {
          let ex = exercises.find((e) => e.id === exId);

          if (!ex) {
            // Exercise not in current catalog — recover from existing plan data
            console.warn('[ManualRoutineBuilder] exercise not in catalog, recovering from plan:', exId);
            for (const dia of existingRoutine?.routine_data.dias ?? []) {
              const found = dia.ejercicios.find((e) => e.exercise_id === exId);
              if (found) {
                ex = {
                  id: exId,
                  nombre: found.nombre,
                  gif_url: found.gif_url ?? null,
                  patron: '', grupo_muscular: '', nivel: '', equipo: '',
                  descripcion_breve: '', caution_notes: [], forbidden: false,
                };
                break;
              }
            }
          }

          if (!ex) {
            console.error('[ManualRoutineBuilder] exercise not found anywhere, skipping:', exId);
            return [];
          }

          return [{
            exercise_id: exId,
            nombre: ex.nombre,
            gif_url: ex.gif_url ?? null,
            series: params.series,
            repeticiones: params.repeticiones || '10',
            descanso_seg: 60,
            nota: params.notas || undefined,
          }];
        });
        return { dia_index: i, nombre: DAYS[dayIdx], ejercicios };
      });

      // Drop days that ended up with no exercises (deselected days, pre-population
      // failures, exercises with missing IDs). Only block if the plan would be
      // completely empty.
      const diasToSend = dias.filter((d) => d.ejercicios.length > 0);
      console.log('[ManualRoutineBuilder] handleSubmit — diasToSend:', JSON.stringify(diasToSend));

      if (diasToSend.length === 0) {
        toast.error('Añade al menos un ejercicio al plan');
        return;
      }

      const isEdit = mode === 'edit' && existingRoutine;
      const res = await fetch(
        isEdit ? `/api/gym/routines/${existingRoutine!.id}` : '/api/gym/routines/manual',
        {
          method: isEdit ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(isEdit ? { dias: diasToSend } : { client_id: clientId, dias: diasToSend }),
        }
      );
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error al guardar plan');
      }
      const { routine } = await res.json();
      toast.success(isEdit ? 'Plan actualizado' : 'Plan manual creado');
      setOpen(false);
      if (isEdit) {
        onUpdated?.(routine);
      } else {
        onCreated?.(routine);
      }
    } catch (err) {
      console.error('[ManualRoutineBuilder] handleSubmit error:', err);
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSubmitting(false);
    }
  };

  // Group exercises by grupo_muscular preserving order from API (already sorted)
  const grouped: [string, ExerciseWithFlags[]][] = [];
  const seen = new Set<string>();
  for (const ex of exercises) {
    if (!seen.has(ex.grupo_muscular)) {
      seen.add(ex.grupo_muscular);
      grouped.push([ex.grupo_muscular, []]);
    }
    grouped.find(([g]) => g === ex.grupo_muscular)![1].push(ex);
  }

  // When searching: filter exercises by name and keep only groups with matches
  const lowerSearch = searchQuery.trim().toLowerCase();
  const visibleGrouped: [string, ExerciseWithFlags[]][] = lowerSearch
    ? grouped
        .map(([g, exs]) => [g, exs.filter((ex) => ex.nombre.toLowerCase().includes(lowerSearch))] as [string, ExerciseWithFlags[]])
        .filter(([, exs]) => exs.length > 0)
    : grouped;

  const activeDayIdx = selectedDays[activeTab] ?? -1;
  const activeDayExercises = dayMap[activeDayIdx] ?? {};
  const activeDayCount = Object.keys(activeDayExercises).length;

  return (
    <>
      <Button variant="outline" onClick={openModal}>
        <Pencil className="h-4 w-4" />
        {mode === 'edit' ? 'Editar plan' : 'Plan manual'}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4">
          <div className="my-8 w-full max-w-3xl rounded-lg border bg-background shadow-xl">

            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold">{mode === 'edit' ? 'Editar plan' : 'Crear plan manual'}</h2>
                <p className="text-sm text-muted-foreground">
                  {step === 1 ? 'Paso 1 · Selecciona los días' : 'Paso 2 · Asigna ejercicios por día'}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 hover:bg-muted transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* ── Step 1: Day picker ── */}
            {step === 1 && (
              <div className="px-6 py-6 space-y-6">
                <div>
                  <p className="mb-3 text-sm font-medium">¿Qué días entrenará el cliente?</p>
                  <div className="flex flex-wrap gap-2">
                    {SHORT_DAYS.map((label, i) => (
                      <button
                        key={i}
                        onClick={() => toggleDay(i)}
                        className={`h-10 w-10 rounded-md border text-sm font-medium transition-colors
                          ${selectedDays.includes(i)
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'hover:bg-muted'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    {selectedDays.length} día{selectedDays.length !== 1 ? 's' : ''} seleccionado{selectedDays.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                  <Button
                    onClick={() => {
                      if (selectedDays.length === 0) { toast.error('Selecciona al menos un día'); return; }
                      setActiveTab(0);
                      setStep(2);
                    }}
                    disabled={selectedDays.length === 0}
                  >
                    Siguiente
                  </Button>
                </div>
              </div>
            )}

            {/* ── Step 2: Exercise builder ── */}
            {step === 2 && (
              <div>
                {/* Hidden input for replacing an exercise's GIF */}
                <input
                  ref={replaceFileInputRef}
                  type="file"
                  accept="image/gif,image/*"
                  className="sr-only"
                  onChange={handleReplaceGif}
                />
                {/* Day tabs */}
                <div className="flex overflow-x-auto border-b px-6 pt-3">
                  {selectedDays.map((dayIdx, i) => {
                    const count = Object.keys(dayMap[dayIdx] ?? {}).length;
                    return (
                      <button
                        key={dayIdx}
                        onClick={() => setActiveTab(i)}
                        className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-2 text-sm font-medium transition-colors
                          ${i === activeTab
                            ? 'border-primary text-primary'
                            : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        {DAYS[dayIdx]}
                        {count > 0 && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Search bar */}
                <div className="border-b px-6 py-2.5">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Buscar ejercicio…"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-md border bg-background py-1.5 pl-9 pr-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Exercise list — scrollable */}
                <div className="max-h-[55vh] overflow-y-auto px-6 py-4 space-y-2">
                  {loadingEx ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Cargando ejercicios…</p>
                  ) : visibleGrouped.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">Sin resultados para &ldquo;{searchQuery}&rdquo;</p>
                  ) : (
                    visibleGrouped.map(([group, exs]) => {
                      const isSearching = !!lowerSearch;
                      const selectedInGroup = exs.filter((ex) => !!activeDayExercises[ex.id]).length;
                      return (
                      <div key={group}>
                        <button
                          onClick={() => toggleGroup(group)}
                          className="flex w-full items-center gap-2 py-1.5 text-left"
                        >
                          {(isSearching || expandedGroups[group])
                            ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                            : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                          <span className={`text-xs font-semibold uppercase tracking-wide capitalize ${selectedInGroup > 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {group}
                          </span>
                          <span className="text-xs text-muted-foreground">({exs.length})</span>
                          {selectedInGroup > 0 && (
                            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                              {selectedInGroup} ✓
                            </span>
                          )}
                        </button>

                        {(isSearching || expandedGroups[group]) && (
                          <div className="ml-6 space-y-1">
                            {exs.map((ex) => {
                              const isSelected = !!activeDayExercises[ex.id];
                              const params = activeDayExercises[ex.id];
                              return (
                                <div
                                  key={ex.id}
                                  className={`rounded-md border transition-colors
                                    ${isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                                >
                                  <label className="flex cursor-pointer items-start gap-3 p-2.5">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleExercise(activeDayIdx, ex)}
                                      className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
                                    />
                                    <div className="relative shrink-0">
                                      <ExerciseThumb gif_url={ex.gif_url} className="h-8 w-8" />
                                      {ex.gif_url && (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            replacingGifForRef.current = ex.id;
                                            replaceFileInputRef.current?.click();
                                          }}
                                          className="absolute inset-0 flex items-center justify-center rounded bg-black/50 opacity-0 hover:opacity-100 transition-opacity"
                                          title="Cambiar imagen"
                                        >
                                          <Camera className="h-3 w-3 text-white" />
                                        </button>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="text-sm font-medium">{ex.nombre}</span>
                                        {ex.forbidden && (
                                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                                            🚫 contraindicado
                                          </span>
                                        )}
                                        {!ex.forbidden && ex.caution_notes.length > 0 && (
                                          <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300">
                                            ⚠️ precaución
                                          </span>
                                        )}
                                      </div>
                                      {!ex.forbidden && ex.caution_notes.length > 0 && (
                                        <p className="mt-0.5 text-[11px] text-yellow-700 dark:text-yellow-400 leading-snug">
                                          {ex.caution_notes[0]}
                                        </p>
                                      )}
                                    </div>
                                  </label>

                                  {isSelected && params && (
                                    <div className="grid grid-cols-3 gap-2 border-t px-3 py-2.5">
                                      <div>
                                        <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                                          Series
                                        </label>
                                        <input
                                          type="number"
                                          min={1}
                                          max={10}
                                          value={params.series}
                                          onChange={(e) =>
                                            updateParam(activeDayIdx, ex.id, 'series', parseInt(e.target.value) || 1)
                                          }
                                          className="w-full rounded border px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                                          Reps / seg
                                        </label>
                                        <input
                                          type="text"
                                          value={params.repeticiones}
                                          onChange={(e) =>
                                            updateParam(activeDayIdx, ex.id, 'repeticiones', e.target.value)
                                          }
                                          placeholder="10-12"
                                          className="w-full rounded border px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                      </div>
                                      <div>
                                        <label className="mb-1 block text-[10px] font-medium text-muted-foreground">
                                          Nota (opcional)
                                        </label>
                                        <input
                                          type="text"
                                          value={params.notas}
                                          onChange={(e) =>
                                            updateParam(activeDayIdx, ex.id, 'notas', e.target.value)
                                          }
                                          placeholder="Adaptación…"
                                          className="w-full rounded border px-2 py-1 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );})
                  )}

                  {/* Suggest-to-catalog banner */}
                  {suggestPrompt && (
                    <div className="mt-2 flex items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
                      <span className="text-muted-foreground">
                        ¿Sugerir <span className="font-medium text-foreground">"{suggestPrompt.nombre}"</span> para el catálogo público?
                      </span>
                      <div className="flex shrink-0 gap-2">
                        <button
                          onClick={handleSuggest}
                          className="rounded px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          Sí, sugerir
                        </button>
                        <button
                          onClick={() => setSuggestPrompt(null)}
                          className="rounded px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                        >
                          No, gracias
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Custom exercise button + inline form */}
                  {!showCustomForm ? (
                    <button
                      onClick={() => setShowCustomForm(true)}
                      className="flex w-full items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary mt-2"
                    >
                      <Plus className="h-4 w-4" />
                      Agregar ejercicio personalizado
                    </button>
                  ) : (
                    <div className="mt-2 rounded-md border bg-muted/30 p-4 space-y-3">
                      <p className="text-sm font-medium">Nuevo ejercicio personalizado</p>
                      <div className="space-y-2">
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                            Nombre *
                          </label>
                          <input
                            type="text"
                            value={customDraft.nombre}
                            onChange={(e) => setCustomDraft((d) => ({ ...d, nombre: e.target.value }))}
                            placeholder="Ej: Extensión de rodilla con banda"
                            className="w-full rounded border px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                            Grupo muscular *
                          </label>
                          <select
                            value={customDraft.grupo_muscular}
                            onChange={(e) => setCustomDraft((d) => ({ ...d, grupo_muscular: e.target.value }))}
                            className="w-full rounded border px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary capitalize"
                          >
                            {MUSCLE_GROUPS.map((g) => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                            Descripción breve (opcional)
                          </label>
                          <input
                            type="text"
                            value={customDraft.descripcion_breve}
                            onChange={(e) => setCustomDraft((d) => ({ ...d, descripcion_breve: e.target.value }))}
                            placeholder="Ej: Con banda elástica, rango parcial"
                            className="w-full rounded border px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                            Imagen o GIF (opcional)
                          </label>
                          {gifPreviewUrl ? (
                            <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                              <ExerciseThumb gif_url={gifPreviewUrl} className="h-10 w-10 shrink-0" />
                              <span className="flex-1 text-xs text-muted-foreground">
                                {uploadingGif ? 'Subiendo…' : 'Lista'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  URL.revokeObjectURL(gifPreviewUrl);
                                  setGifPreviewUrl(null);
                                  setCustomDraft((d) => ({ ...d, gif_url: '' }));
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                                className="text-muted-foreground hover:text-foreground"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                              <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/gif,image/*"
                                className="sr-only"
                                onChange={handleFileSelect}
                                disabled={uploadingGif}
                              />
                              <span>Seleccionar archivo…</span>
                            </label>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={cancelCustomForm}
                          disabled={savingCustom || uploadingGif}
                        >
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={handleAddCustom} disabled={savingCustom || uploadingGif}>
                          {savingCustom ? 'Guardando…' : 'Agregar'}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t px-6 py-4">
                  <p className="text-sm text-muted-foreground">
                    {activeDayCount} ejercicio{activeDayCount !== 1 ? 's' : ''} en {DAYS[activeDayIdx]}
                  </p>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      {mode === 'edit' ? 'Cambiar días' : 'Atrás'}
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                      {submitting ? 'Guardando…' : mode === 'edit' ? 'Actualizar plan' : 'Crear plan'}
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </>
  );
}
