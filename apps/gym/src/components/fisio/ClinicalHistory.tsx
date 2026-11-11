'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Activity, X, Plus, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import toast from 'react-hot-toast';

interface MeasurementType {
  code: string;
  label: string;
  unit_default: string | null;
  category: string;
  min_value: number | null;
  max_value: number | null;
}

interface RawMeasurement {
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

interface GroupedType {
  code: string;
  label: string;
  category: string;
  unit: string | null;
  entries: Array<{ id: string; value: number; measured_at: string; notes: string | null }>;
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
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function daysBetween(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);
}

function SparkLine({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 80, H = 28;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * W;
    const y = H - ((v - min) / range) * (H - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="text-primary opacity-70">
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {values.map((v, i) => {
        const x = (i / (values.length - 1)) * W;
        const y = H - ((v - min) / range) * (H - 4) - 2;
        return <circle key={i} cx={x} cy={y} r="2" fill="currentColor" />;
      })}
    </svg>
  );
}

function HistoryChart({ entries, unit }: { entries: GroupedType['entries']; unit: string | null }) {
  const sorted = [...entries].sort((a, b) => a.measured_at.localeCompare(b.measured_at));
  if (sorted.length < 2) return null;
  const values = sorted.map(e => e.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const W = 320, H = 80, PAD = 24;
  const innerW = W - PAD * 2;
  const innerH = H - 16;

  const pts = sorted.map((e, i) => {
    const x = PAD + (i / (sorted.length - 1)) * innerW;
    const y = H - 8 - ((e.value - min) / range) * innerH;
    return { x, y, ...e };
  });

  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  return (
    <div className="rounded-lg border bg-muted/30 p-3 mb-4">
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible text-primary">
        <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="currentColor" />
            <text
              x={p.x} y={H}
              textAnchor="middle"
              fontSize="9"
              fill="currentColor"
              opacity="0.5"
            >
              {new Date(p.measured_at + 'T00:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit' })}
            </text>
          </g>
        ))}
        <text x={PAD} y={pts[0]?.y - 6} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6">
          {min}{unit ? ` ${unit}` : ''}
        </text>
        <text x={PAD + innerW} y={pts[pts.length - 1]?.y - 6} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.6">
          {max}{unit ? ` ${unit}` : ''}
        </text>
      </svg>
    </div>
  );
}

function Delta({ current, previous, unit }: { current: number; previous: number; unit: string | null }) {
  const diff = current - previous;
  const pct = Math.abs((diff / previous) * 100).toFixed(1);
  const u = unit ? ` ${unit}` : '';
  if (Math.abs(diff) < 0.01) return <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Minus className="h-3 w-3" />Sin cambio</span>;
  if (diff < 0) return (
    <span className="text-xs text-emerald-600 flex items-center gap-0.5">
      <TrendingDown className="h-3 w-3" />{diff.toFixed(1)}{u} ({pct}%)
    </span>
  );
  return (
    <span className="text-xs text-rose-500 flex items-center gap-0.5">
      <TrendingUp className="h-3 w-3" />+{diff.toFixed(1)}{u} ({pct}%)
    </span>
  );
}

interface Props { clientId: string }

export function ClinicalHistory({ clientId }: Props) {
  const [grouped, setGrouped] = useState<Record<string, GroupedType[]>>({});
  const [types, setTypes] = useState<MeasurementType[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyModal, setHistoryModal] = useState<GroupedType | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  // Add measurement form state
  const [selectedType, setSelectedType] = useState('');
  const [value, setValue] = useState('');
  const [measuredAt, setMeasuredAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customLabel, setCustomLabel] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [customCategory, setCustomCategory] = useState('escala_clinica');
  const [creatingCustom, setCreatingCustom] = useState(false);

  const load = () => {
    Promise.all([
      fetch(`/api/gym/measurements?client_id=${clientId}`).then(r => r.json()),
      fetch('/api/gym/measurement-types').then(r => r.json()),
    ])
      .then(([mRes, tRes]) => {
        const raw: RawMeasurement[] = mRes.measurements ?? [];
        setTypes(tRes.types ?? []);

        // Group by type code
        const byType = new Map<string, GroupedType>();
        for (const m of raw) {
          if (!byType.has(m.measurement_type)) {
            byType.set(m.measurement_type, {
              code: m.measurement_type,
              label: m.measurement_types?.label ?? m.measurement_type,
              category: m.measurement_types?.category ?? 'antropometrico',
              unit: m.unit ?? m.measurement_types?.unit_default ?? null,
              entries: [],
            });
          }
          byType.get(m.measurement_type)!.entries.push({
            id: m.id,
            value: m.value,
            measured_at: m.measured_at,
            notes: m.notes,
          });
        }

        // Group by category
        const result: Record<string, GroupedType[]> = {};
        for (const gt of byType.values()) {
          if (!result[gt.category]) result[gt.category] = [];
          result[gt.category].push(gt);
        }
        setGrouped(result);
      })
      .catch(() => toast.error('Error al cargar mediciones'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [clientId]);

  const selectedTypeMeta = types.find(t => t.code === selectedType) ?? null;

  const openAdd = () => {
    setSelectedType(''); setValue(''); setNotes('');
    setMeasuredAt(new Date().toISOString().slice(0, 10));
    setShowCustomForm(false); setCustomLabel(''); setCustomUnit('');
    setCustomCategory('escala_clinica');
    setAddOpen(true);
  };

  const handleCreateCustomType = async () => {
    if (!customLabel.trim()) { toast.error('El nombre es requerido'); return; }
    setCreatingCustom(true);
    try {
      const res = await fetch('/api/gym/measurement-types/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: customLabel.trim(), unit: customUnit.trim() || undefined, category: customCategory }),
      });
      if (!res.ok) { const { error } = await res.json(); throw new Error(error ?? 'Error al crear tipo'); }
      const { type } = await res.json();
      setTypes(prev => [...prev, type]);
      setSelectedType(type.code);
      setShowCustomForm(false); setCustomLabel(''); setCustomUnit(''); setCustomCategory('escala_clinica');
      toast.success('Tipo de medición creado');
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error inesperado'); }
    finally { setCreatingCustom(false); }
  };

  const handleSave = async () => {
    if (!selectedType || value === '') { toast.error('Selecciona un tipo y valor'); return; }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) { toast.error('El valor debe ser un número'); return; }
    if (selectedTypeMeta?.min_value !== null && numValue < (selectedTypeMeta?.min_value ?? -Infinity)) {
      toast.error(`Valor mínimo: ${selectedTypeMeta!.min_value}`); return;
    }
    if (selectedTypeMeta?.max_value !== null && numValue > (selectedTypeMeta?.max_value ?? Infinity)) {
      toast.error(`Valor máximo: ${selectedTypeMeta!.max_value}`); return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/gym/measurements', {
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
      if (!res.ok) { const { error } = await res.json(); throw new Error(error ?? 'Error al guardar'); }
      toast.success('Medición registrada');
      setAddOpen(false);
      setLoading(true);
      load();
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Error inesperado'); }
    finally { setSaving(false); }
  };

  const typesByCategory = CATEGORY_ORDER.reduce<Record<string, MeasurementType[]>>((acc, cat) => {
    const items = types.filter(t => t.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  const hasData = Object.keys(grouped).length > 0;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Mediciones y progreso
            </CardTitle>
            <Button variant="outline" size="sm" onClick={openAdd}>
              <Plus className="h-4 w-4" />
              Registrar medición
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : !hasData ? (
            <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
              <Activity className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Sin mediciones registradas</p>
            </div>
          ) : (
            <div className="space-y-4">
              {CATEGORY_ORDER.filter(cat => grouped[cat]).map(cat => (
                <div key={cat}>
                  <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[cat]}
                  </p>
                  <div className="rounded-md border divide-y">
                    {grouped[cat].map(gt => {
                      const latest = gt.entries[0];
                      const previous = gt.entries[1];
                      const u = gt.unit;
                      return (
                        <button
                          key={gt.code}
                          onClick={() => setHistoryModal(gt)}
                          className="w-full flex items-center justify-between px-3 py-2.5 text-sm hover:bg-muted/50 transition-colors text-left"
                        >
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium">{gt.label}</span>
                            {previous && (
                              <Delta current={latest.value} previous={previous.value} unit={u} />
                            )}
                            {gt.entries.length > 1 && (
                              <span className="text-xs text-muted-foreground">
                                {gt.entries.length} registros
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            {gt.entries.length >= 2 && (
                              <SparkLine values={[...gt.entries].reverse().map(e => e.value)} />
                            )}
                            <div className="text-right">
                              <div className="font-semibold tabular-nums">
                                {latest.value}{u ? ` ${u}` : ''}
                              </div>
                              <div className="text-xs text-muted-foreground">{formatDate(latest.measured_at)}</div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History modal */}
      {historyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-background shadow-xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between border-b px-5 py-4 shrink-0">
              <div>
                <h2 className="text-base font-semibold">{historyModal.label}</h2>
                <p className="text-xs text-muted-foreground">{historyModal.entries.length} registros</p>
              </div>
              <button onClick={() => setHistoryModal(null)} className="rounded p-1 hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4 space-y-4">
              <HistoryChart entries={historyModal.entries} unit={historyModal.unit} />
              <div className="divide-y rounded-md border">
                {historyModal.entries.map((e, i) => {
                  const prev = historyModal.entries[i + 1];
                  return (
                    <div key={e.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                      <div>
                        <div className="font-medium tabular-nums">
                          {e.value}{historyModal.unit ? ` ${historyModal.unit}` : ''}
                        </div>
                        {prev && <Delta current={e.value} previous={prev.value} unit={historyModal.unit} />}
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">{formatDate(e.measured_at)}</div>
                        {i > 0 && (
                          <div className="text-xs text-muted-foreground">
                            hace {daysBetween(e.measured_at, historyModal.entries[0].measured_at)}d
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add measurement modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-base font-semibold">Registrar medición</h2>
              <button onClick={() => setAddOpen(false)} className="rounded p-1 hover:bg-muted">
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
                  onChange={e => {
                    if (e.target.value === '__custom__') { setSelectedType('__custom__'); setShowCustomForm(true); setValue(''); }
                    else { setSelectedType(e.target.value); setShowCustomForm(false); setValue(''); }
                  }}
                  className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">Selecciona un tipo…</option>
                  {CATEGORY_ORDER.filter(cat => typesByCategory[cat]).map(cat => (
                    <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                      {typesByCategory[cat].map(t => (
                        <option key={t.code} value={t.code}>{t.label}</option>
                      ))}
                    </optgroup>
                  ))}
                  <option value="__custom__">+ Agregar tipo personalizado</option>
                </select>

                {showCustomForm && (
                  <div className="mt-2 rounded-md border bg-muted/30 p-3 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nuevo tipo</p>
                    <input
                      type="text" value={customLabel} onChange={e => setCustomLabel(e.target.value)}
                      placeholder="Nombre *" autoFocus
                      className="w-full rounded border px-3 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <div className="flex gap-2">
                      <select value={customCategory} onChange={e => setCustomCategory(e.target.value)}
                        className="flex-1 rounded border px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary">
                        {CATEGORY_ORDER.map(cat => <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>)}
                      </select>
                      <input type="text" value={customUnit} onChange={e => setCustomUnit(e.target.value)}
                        placeholder="Unidad" className="w-20 rounded border px-2 py-1.5 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => { setShowCustomForm(false); setSelectedType(''); }} disabled={creatingCustom}>Cancelar</Button>
                      <Button size="sm" onClick={handleCreateCustomType} disabled={creatingCustom || !customLabel.trim()}>
                        {creatingCustom ? 'Creando…' : 'Crear tipo'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {!showCustomForm && selectedType && selectedType !== '__custom__' && (
                <>
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Valor{selectedTypeMeta?.min_value !== null && selectedTypeMeta?.max_value !== null
                          ? ` (${selectedTypeMeta.min_value}–${selectedTypeMeta.max_value})` : ''}
                      </label>
                      <input type="number" value={value} onChange={e => setValue(e.target.value)} placeholder="0"
                        className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                    </div>
                    {selectedTypeMeta?.unit_default && (
                      <div className="w-24 flex flex-col justify-end">
                        <span className="block rounded border bg-muted px-3 py-2 text-sm text-muted-foreground">{selectedTypeMeta.unit_default}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">Fecha</label>
                    <input type="date" value={measuredAt} onChange={e => setMeasuredAt(e.target.value)}
                      className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground uppercase tracking-wide">Notas (opcional)</label>
                    <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones…"
                      className="w-full rounded border px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t px-5 py-4">
              <Button variant="outline" size="sm" onClick={() => setAddOpen(false)} disabled={saving || creatingCustom}>Cancelar</Button>
              <Button size="sm" onClick={handleSave}
                disabled={saving || showCustomForm || !selectedType || selectedType === '__custom__' || value === ''}>
                {saving ? 'Guardando…' : 'Registrar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
