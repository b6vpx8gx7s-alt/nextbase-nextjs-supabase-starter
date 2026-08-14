'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, X, Plus } from 'lucide-react';
import toast from 'react-hot-toast';

interface MeasurementType {
  code: string;
  label: string;
  unit_default: string | null;
  category: string;
  min_value: number | null;
  max_value: number | null;
}

interface Measurement {
  id: string;
  measurement_type: string;
  value: number;
  unit: string | null;
  measured_at: string;
  notes: string | null;
  measurement_types: {
    label: string;
    category: string;
    unit_default: string | null;
    min_value: number | null;
    max_value: number | null;
  } | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  escala_clinica: 'Escalas clínicas',
  rom: 'Rango de movimiento',
  antropometrico: 'Antropométrico',
  composicion_corporal: 'Composición corporal',
};

const CATEGORY_ORDER = ['escala_clinica', 'rom', 'antropometrico', 'composicion_corporal'];

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatValue(m: Measurement) {
  const unit = m.unit ?? m.measurement_types?.unit_default ?? '';
  const max = m.measurement_types?.max_value;
  if (max !== null && max !== undefined) {
    return `${m.value} / ${max} ${unit}`.trim();
  }
  return `${m.value}${unit ? ' ' + unit : ''}`;
}

interface Props {
  clientId: string;
}

export function ClinicalHistory({ clientId }: Props) {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [types, setTypes] = useState<MeasurementType[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  // Form state
  const [selectedType, setSelectedType] = useState('');
  const [value, setValue] = useState('');
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Custom type mini-form
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [customCategory, setCustomCategory] = useState('escala_clinica');
  const [creatingCustom, setCreatingCustom] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`/api/fisio/measurements?client_id=${clientId}`).then((r) => r.json()),
      fetch('/api/fisio/measurement-types').then((r) => r.json()),
    ])
      .then(([mRes, tRes]) => {
        setMeasurements(mRes.measurements ?? []);
        setTypes(tRes.types ?? []);
      })
      .catch(() => toast.error('Error al cargar historial clínico'))
      .finally(() => setLoading(false));
  }, [clientId]);

  const openModal = () => {
    setSelectedType('');
    setValue('');
    setMeasuredAt(new Date().toISOString().slice(0, 10));
    setNotes('');
    setShowCustomForm(false);
    setCustomLabel('');
    setCustomUnit('');
    setCustomCategory('escala_clinica');
    setOpen(true);
  };

  const cancelCustomForm = () => {
    setShowCustomForm(false);
    setSelectedType('');
    setCustomLabel('');
    setCustomUnit('');
    setCustomCategory('escala_clinica');
  };

  const handleCreateCustomType = async () => {
    if (!customLabel.trim()) {
      toast.error('El nombre es requerido');
      return;
    }
    setCreatingCustom(true);
    try {
      const res = await fetch('/api/fisio/measurement-types/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: customLabel.trim(),
          unit: customUnit.trim() || undefined,
          category: customCategory,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error al crear tipo');
      }
      const { type } = await res.json();
      setTypes((prev) => [...prev, type]);
      setSelectedType(type.code);
      setShowCustomForm(false);
      setCustomLabel('');
      setCustomUnit('');
      setCustomCategory('escala_clinica');
      toast.success('Tipo de medición creado');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setCreatingCustom(false);
    }
  };

  const selectedTypeMeta = types.find((t) => t.code === selectedType) ?? null;

  const handleSave = async () => {
    if (!selectedType || value === '') {
      toast.error('Selecciona un tipo y valor');
      return;
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
      toast.error('El valor debe ser un número');
      return;
    }
    if (selectedTypeMeta?.min_value !== null && numValue < (selectedTypeMeta?.min_value ?? -Infinity)) {
      toast.error(`Valor mínimo: ${selectedTypeMeta!.min_value}`);
      return;
    }
    if (selectedTypeMeta?.max_value !== null && numValue > (selectedTypeMeta?.max_value ?? Infinity)) {
      toast.error(`Valor máximo: ${selectedTypeMeta!.max_value}`);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/fisio/measurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          measurement_type: selectedType,
          value: numValue,
          unit: selectedTypeMeta?.unit_default ?? null,
          measured_at: measuredAt,
          notes: notes.trim() || null,
        }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error al guardar');
      }
      const { measurement } = await res.json();
      // Replace existing entry for this type or prepend
      setMeasurements((prev) => {
        const filtered = prev.filter((m) => m.measurement_type !== selectedType);
        return [measurement, ...filtered];
      });
      toast.success('Medición registrada');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  // Group measurements by category
  const grouped = CATEGORY_ORDER.reduce<Record<string, Measurement[]>>((acc, cat) => {
    const items = measurements.filter((m) => m.measurement_types?.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  // Group types by category for the dropdown
  const typesByCategory = CATEGORY_ORDER.reduce<Record<string, MeasurementType[]>>((acc, cat) => {
    const items = types.filter((t) => t.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Historial clínico
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openModal}>
              <Plus className="h-4 w-4" />
              Registrar medición
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <Activity className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sin mediciones registradas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {CATEGORY_ORDER.filter((cat) => grouped[cat]).map((cat) => (
                <div key={cat}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  <div className="rounded-md border divide-y">
                    {grouped[cat].map((m) => (
                      <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span className="font-medium">{m.measurement_types?.label ?? m.measurement_type}</span>
                        <div className="flex items-center gap-3 text-right">
                          <span className="font-semibold tabular-nums">{formatValue(m)}</span>
                          <span className="text-xs text-muted-foreground">{formatDate(m.measured_at)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Registrar medición</h2>
              <button onClick={() => setOpen(false)} className="rounded p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Tipo de medición
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__custom__') {
                      setSelectedType('__custom__');
                      setShowCustomForm(true);
                      setValue('');
                    } else {
                      setSelectedType(val);
                      setShowCustomForm(false);
                      setValue('');
                    }
                  }}
                  className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Selecciona un tipo…</option>
                  {CATEGORY_ORDER.filter((cat) => typesByCategory[cat]).map((cat) => (
                    <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                      {typesByCategory[cat].map((t) => (
                        <option key={t.code} value={t.code}>{t.label}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__custom__">+ Agregar tipo personalizado</option>
                </select>

                {/* Custom type mini-form */}
                {showCustomForm && (
                  <div className="mt-2 rounded-md border bg-muted/30 p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Nuevo tipo de medición
                    </p>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Nombre *
                      </label>
                      <input
                        type="text"
                        value={customLabel}
                        onChange={(e) => setCustomLabel(e.target.value)}
                        placeholder="Ej: Fuerza de agarre"
                        autoFocus
                        className="w-full rounded border px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Categoría
                        </label>
                        <select
                          value={customCategory}
                          onChange={(e) => setCustomCategory(e.target.value)}
                          className="w-full rounded border px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {CATEGORY_ORDER.map((cat) => (
                            <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-24">
                        <label className="mb-1 block text-xs font-medium text-muted-foreground">
                          Unidad
                        </label>
                        <input
                          type="text"
                          value={customUnit}
                          onChange={(e) => setCustomUnit(e.target.value)}
                          placeholder="kg, °, pts…"
                          className="w-full rounded border px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={cancelCustomForm}
                        disabled={creatingCustom}
                      >
                        Cancelar
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleCreateCustomType}
                        disabled={creatingCustom || !customLabel.trim()}
                      >
                        {creatingCustom ? 'Creando…' : 'Crear tipo'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Value / date / notes — hidden while the custom form is open */}
              {!showCustomForm && selectedType && selectedType !== '__custom__' && (
                <>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Valor
                        {selectedTypeMeta && selectedTypeMeta.min_value !== null && selectedTypeMeta.max_value !== null
                          ? ` (${selectedTypeMeta.min_value}–${selectedTypeMeta.max_value})`
                          : ''}
                      </label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="0"
                        className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    {selectedTypeMeta?.unit_default && (
                      <div className="w-24 flex flex-col justify-end">
                        <span className="block rounded border bg-muted px-3 py-2 text-sm text-muted-foreground">
                          {selectedTypeMeta.unit_default}
                        </span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Fecha
                    </label>
                    <input
                      type="date"
                      value={measuredAt}
                      onChange={(e) => setMeasuredAt(e.target.value)}
                      className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Notas (opcional)
                    </label>
                    <input
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Observaciones…"
                      className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={saving || creatingCustom}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving || showCustomForm || !selectedType || selectedType === '__custom__' || value === ''}
              >
                {saving ? 'Guardando…' : 'Registrar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
