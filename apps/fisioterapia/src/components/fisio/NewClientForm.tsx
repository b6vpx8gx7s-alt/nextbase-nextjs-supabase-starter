'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Plus, Trash2, ChevronRight, ChevronLeft, Check, Search, UserPlus, Link } from 'lucide-react';
import toast from 'react-hot-toast';

const ZONAS = [
  'Columna cervical', 'Columna lumbar', 'Hombro derecho', 'Hombro izquierdo',
  'Rodilla derecha', 'Rodilla izquierda', 'Cadera derecha', 'Cadera izquierda',
  'Tobillo derecho', 'Tobillo izquierdo', 'Muneca', 'Codo',
  'Cabeza / cuello', 'Pecho / costillas', 'Abdomen', 'Pie derecho', 'Pie izquierdo',
];

const MECANICA_OPTS = ['al mover', 'al cargar peso', 'en reposo', 'al estirar', 'al caminar', 'al subir escaleras'];

const DIAS_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface RodaCustomer {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
}

interface PathologyEntry {
  nombre: string;
  zona_corporal: string;
  notas: string;
}

interface PainEntry {
  zona_corporal: string;
  mecanica: string;
  nivel: number;
}

type Step = 'vincular' | 'datos' | 'patologias' | 'dolor' | 'plan';

const STEP_LABELS: Record<Step, string> = {
  vincular: 'Vincular RODA',
  datos: 'Datos básicos',
  patologias: 'Patologías',
  dolor: 'Mapa de dolor',
  plan: 'Plan',
};

export function NewClientForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('vincular');
  const [loading, setLoading] = useState(false);

  // Step 0: Vincular cliente RODA
  const [rodaCustomerId, setRodaCustomerId] = useState<string | null>(null);
  const [rodaLinkedName, setRodaLinkedName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<RodaCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step 1: Datos básicos
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [notas, setNotas] = useState('');

  // Step 2: Patologías
  const [pathologies, setPathologies] = useState<PathologyEntry[]>([]);
  const [newPath, setNewPath] = useState<PathologyEntry>({ nombre: '', zona_corporal: ZONAS[0], notas: '' });

  // Step 3: Dolor
  const [painEntries, setPainEntries] = useState<PainEntry[]>([]);
  const [newPain, setNewPain] = useState<PainEntry>({ zona_corporal: ZONAS[0], mecanica: MECANICA_OPTS[0], nivel: 5 });

  // Step 4: Plan
  const [nivelFisico, setNivelFisico] = useState<'principiante' | 'intermedio' | 'avanzado'>('principiante');
  const [objetivo, setObjetivo] = useState('rehabilitacion');
  const [dias, setDias] = useState<number[]>([]);

  // Debounced search against RODA customers
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (search.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/fisio/roda-customers?search=${encodeURIComponent(search.trim())}`);
        if (res.ok) {
          const { customers } = await res.json();
          setSearchResults(customers ?? []);
        }
      } catch {
        // silently ignore search errors
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const handleSelectRodaCustomer = (customer: RodaCustomer) => {
    setRodaCustomerId(customer.id);
    setRodaLinkedName(customer.nombre);
    setNombre(customer.nombre);
    setTelefono(customer.telefono ?? '');
    setEmail(customer.email ?? '');
    setSearch('');
    setSearchResults([]);
    setStep('datos');
  };

  const handleSkipLink = () => {
    setRodaCustomerId(null);
    setRodaLinkedName(null);
    setStep('datos');
  };

  const addPathology = () => {
    if (!newPath.nombre.trim()) return;
    setPathologies((prev) => [...prev, { ...newPath }]);
    setNewPath({ nombre: '', zona_corporal: ZONAS[0], notas: '' });
  };

  const addPain = () => {
    setPainEntries((prev) => [...prev, { ...newPain }]);
    setNewPain({ zona_corporal: ZONAS[0], mecanica: MECANICA_OPTS[0], nivel: 5 });
  };

  const toggleDia = (d: number) =>
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const handleSubmit = async () => {
    if (!nombre.trim()) { toast.error('El nombre es requerido'); return; }
    if (dias.length === 0) { toast.error('Selecciona al menos un día de entrenamiento'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/fisio/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre, email, telefono, notas,
          nivel_fisico: nivelFisico,
          objetivo,
          dias_disponibles: dias,
          pathologies,
          pain_entries: painEntries,
          roda_customer_id: rodaCustomerId,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error al guardar');
      }

      const { client } = await res.json();
      toast.success('Paciente creado');
      router.push(`/pacientes/${client.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const steps: Step[] = ['vincular', 'datos', 'patologias', 'dolor', 'plan'];
  const stepIndex = steps.indexOf(step);

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center gap-2 flex-wrap">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold
              ${i < stepIndex ? 'bg-primary text-primary-foreground'
                : i === stepIndex ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                : 'bg-muted text-muted-foreground'}`}>
              {i < stepIndex ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-0.5 w-6 ${i < stepIndex ? 'bg-primary' : 'bg-muted'}`} />
            )}
          </div>
        ))}
        <span className="ml-2 text-sm text-muted-foreground">{STEP_LABELS[step]}</span>
      </div>

      {/* Step 0: Vincular RODA */}
      {step === 'vincular' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Busca si el paciente ya existe como cliente en RODA para vincular sus datos automáticamente.
          </p>

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-md border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre o teléfono…"
              autoFocus
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Buscando…
              </span>
            )}
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <ul className="divide-y rounded-md border overflow-hidden">
              {searchResults.map((c) => (
                <li key={c.id}>
                  <button
                    className="w-full text-left px-4 py-3 hover:bg-muted transition-colors text-sm"
                    onClick={() => handleSelectRodaCustomer(c)}
                  >
                    <div className="flex items-center gap-2">
                      <Link className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="font-medium">{c.nombre}</span>
                      <span className="text-muted-foreground">{c.telefono}</span>
                      {c.email && <span className="text-muted-foreground hidden sm:inline">{c.email}</span>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {search.trim().length >= 2 && !isSearching && searchResults.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">
              No se encontraron clientes con ese criterio.
            </p>
          )}

          {/* Skip */}
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={handleSkipLink}
            >
              <UserPlus className="h-4 w-4" />
              Crear paciente nuevo (sin vincular)
            </Button>
          </div>
        </div>
      )}

      {/* Step 1: Datos */}
      {step === 'datos' && (
        <div className="space-y-4">
          {rodaLinkedName && (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <Link className="h-4 w-4 text-primary shrink-0" />
              <span>Vinculado a cliente RODA: <strong>{rodaLinkedName}</strong></span>
              <button
                className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => {
                  setRodaCustomerId(null);
                  setRodaLinkedName(null);
                  setStep('vincular');
                }}
              >
                Cambiar
              </button>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium mb-1">Nombre *</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={nombre} onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del paciente"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="correo@ejemplo.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Teléfono</label>
              <input
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                value={telefono} onChange={(e) => setTelefono(e.target.value)}
                placeholder="+57 3xx xxx xxxx"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notas generales</label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background resize-none"
              rows={3} value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Antecedentes relevantes…"
            />
          </div>
        </div>
      )}

      {/* Step 2: Patologías */}
      {step === 'patologias' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Registra las patologías o condiciones médicas del paciente.
          </p>
          {pathologies.length > 0 && (
            <ul className="space-y-2">
              {pathologies.map((p, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="flex-1"><strong>{p.nombre}</strong> — {p.zona_corporal}</span>
                  <button onClick={() => setPathologies((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-md border p-4 space-y-3">
            <input
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={newPath.nombre}
              onChange={(e) => setNewPath((p) => ({ ...p, nombre: e.target.value }))}
              placeholder="Nombre de la patología (ej: Hernia discal L4-L5)"
            />
            <select
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={newPath.zona_corporal}
              onChange={(e) => setNewPath((p) => ({ ...p, zona_corporal: e.target.value }))}
            >
              {ZONAS.map((z) => <option key={z}>{z}</option>)}
            </select>
            <Button type="button" variant="outline" size="sm" onClick={addPathology} className="w-full">
              <Plus className="h-4 w-4" /> Agregar patología
            </Button>
          </div>
          {pathologies.length === 0 && (
            <p className="text-xs text-muted-foreground italic text-center">
              Puedes continuar sin patologías si el paciente no tiene condiciones médicas.
            </p>
          )}
        </div>
      )}

      {/* Step 3: Mapa de dolor */}
      {step === 'dolor' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Registra las zonas de dolor activo del paciente (escala 1–10).
          </p>
          {painEntries.length > 0 && (
            <ul className="space-y-2">
              {painEntries.map((p, i) => (
                <li key={i} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="flex-1">
                    <strong>{p.zona_corporal}</strong> — {p.mecanica} — nivel {p.nivel}/10
                  </span>
                  <button onClick={() => setPainEntries((prev) => prev.filter((_, j) => j !== i))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="rounded-md border p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1">Zona corporal</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  value={newPain.zona_corporal}
                  onChange={(e) => setNewPain((p) => ({ ...p, zona_corporal: e.target.value }))}
                >
                  {ZONAS.map((z) => <option key={z}>{z}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Aparece…</label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                  value={newPain.mecanica}
                  onChange={(e) => setNewPain((p) => ({ ...p, mecanica: e.target.value }))}
                >
                  {MECANICA_OPTS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-2">
                Intensidad: <span className="font-bold">{newPain.nivel}/10</span>
              </label>
              <input
                type="range" min={1} max={10} value={newPain.nivel}
                onChange={(e) => setNewPain((p) => ({ ...p, nivel: Number(e.target.value) }))}
                className="w-full accent-primary"
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addPain} className="w-full">
              <Plus className="h-4 w-4" /> Agregar zona de dolor
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Plan */}
      {step === 'plan' && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Nivel físico</label>
            <div className="flex gap-2">
              {(['principiante', 'intermedio', 'avanzado'] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setNivelFisico(n)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors capitalize
                    ${nivelFisico === n ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Objetivo principal</label>
            <select
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={objetivo} onChange={(e) => setObjetivo(e.target.value)}
            >
              <option value="rehabilitacion">Rehabilitación y fisioterapia</option>
              <option value="movilidad">Mejorar movilidad y flexibilidad</option>
              <option value="fuerza">Ganar fuerza</option>
              <option value="cardio">Resistencia cardiovascular</option>
              <option value="perder_peso">Perder peso</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">
              Días de entrenamiento *
            </label>
            <div className="flex gap-2 flex-wrap">
              {DIAS_LABEL.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDia(i)}
                  className={`h-9 w-9 rounded-md border text-sm font-medium transition-colors
                    ${dias.includes(i) ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {dias.length} día{dias.length !== 1 ? 's' : ''} seleccionado{dias.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <Button
          variant="outline" size="sm"
          onClick={() => setStep(steps[stepIndex - 1])}
          disabled={stepIndex === 0}
        >
          <ChevronLeft className="h-4 w-4" /> Anterior
        </Button>

        {stepIndex < steps.length - 1 ? (
          <Button
            size="sm"
            onClick={() => {
              if (step === 'datos' && !nombre.trim()) {
                toast.error('El nombre es requerido');
                return;
              }
              setStep(steps[stepIndex + 1]);
            }}
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button size="sm" onClick={handleSubmit} disabled={loading}>
            {loading ? 'Guardando…' : 'Crear paciente'}
            {!loading && <Check className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
