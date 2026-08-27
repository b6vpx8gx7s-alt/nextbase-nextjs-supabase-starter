'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronRight, ChevronLeft, Check, Search, UserPlus, Link } from 'lucide-react';
import toast from 'react-hot-toast';

const DIAS_LABEL = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const OBJETIVOS = [
  { value: 'hipertrofia', label: 'Hipertrofia muscular' },
  { value: 'perdida_grasa', label: 'Pérdida de grasa' },
  { value: 'fuerza', label: 'Ganar fuerza' },
  { value: 'resistencia', label: 'Resistencia y cardio' },
  { value: 'rendimiento', label: 'Rendimiento deportivo' },
];

const ZONAS_MEJORAR = [
  'Pecho', 'Hombros', 'Espalda', 'Bíceps', 'Tríceps',
  'Abdomen', 'Glúteos', 'Piernas', 'Pantorrillas', 'General',
];

interface RodaCustomer {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
}

type Step = 'vincular' | 'datos' | 'entrenamiento' | 'salud' | 'plan';

const STEP_LABELS: Record<Step, string> = {
  vincular: 'Vincular RODA',
  datos: 'Datos básicos',
  entrenamiento: 'Entrenamiento',
  salud: 'Salud',
  plan: 'Horario',
};

export function NewClientForm() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('vincular');
  const [loading, setLoading] = useState(false);

  // Step vincular
  const [rodaCustomerId, setRodaCustomerId] = useState<string | null>(null);
  const [rodaLinkedName, setRodaLinkedName] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<RodaCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Step datos
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [telefono, setTelefono] = useState('');
  const [sexo, setSexo] = useState<'masculino' | 'femenino' | 'otro' | ''>('');
  const [notas, setNotas] = useState('');

  // Step entrenamiento
  const [nivelEntrenamiento, setNivelEntrenamiento] = useState<'novato' | 'intermedio' | 'avanzado'>('novato');
  const [objetivoPrincipal, setObjetivoPrincipal] = useState('hipertrofia');
  const [tiempoEntrenando, setTiempoEntrenando] = useState('');
  const [deporteAlterno, setDeporteAlterno] = useState('');

  // Step salud
  const [usaEsteroides, setUsaEsteroides] = useState(false);
  const [problemaCardiovascular, setProblemaCardiovascular] = useState('');
  const [lesionActual, setLesionActual] = useState('');
  const [zonaAMejorar, setZonaAMejorar] = useState('');

  // Step plan
  const [horarioLaboral, setHorarioLaboral] = useState('');
  const [horaDespertar, setHoraDespertar] = useState('');
  const [horaDormir, setHoraDormir] = useState('');
  const [horaEntrenar, setHoraEntrenar] = useState('');
  const [dias, setDias] = useState<number[]>([]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (search.trim().length < 2) { setSearchResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/gym/roda-customers?search=${encodeURIComponent(search.trim())}`);
        if (res.ok) {
          const { customers } = await res.json();
          setSearchResults(customers ?? []);
        }
      } catch { /* ignore */ } finally { setIsSearching(false); }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
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

  const toggleDia = (d: number) =>
    setDias((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));

  const handleSubmit = async () => {
    if (!nombre.trim()) { toast.error('El nombre es requerido'); return; }
    if (dias.length === 0) { toast.error('Selecciona al menos un día de entrenamiento'); return; }

    setLoading(true);
    try {
      const res = await fetch('/api/gym/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          email: email || null,
          telefono: telefono || null,
          notas: notas || null,
          sexo: sexo || null,
          nivel_entrenamiento: nivelEntrenamiento,
          objetivo_principal: objetivoPrincipal,
          tiempo_entrenando: tiempoEntrenando || null,
          deporte_alterno: deporteAlterno || null,
          usa_esteroides: usaEsteroides,
          problema_cardiovascular: problemaCardiovascular || null,
          lesion_actual: lesionActual || null,
          zona_a_mejorar: zonaAMejorar || null,
          horario_laboral: horarioLaboral || null,
          hora_despertar: horaDespertar || null,
          hora_dormir: horaDormir || null,
          hora_entrenar: horaEntrenar || null,
          dias_disponibles: dias,
          roda_customer_id: rodaCustomerId,
        }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error al guardar');
      }

      const { client } = await res.json();
      toast.success('Cliente creado');
      router.push(`/clientes/${client.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const steps: Step[] = ['vincular', 'datos', 'entrenamiento', 'salud', 'plan'];
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

      {/* Step vincular */}
      {step === 'vincular' && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Busca si el cliente ya existe en RODA para vincular sus datos automáticamente.
          </p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              className="w-full rounded-md border pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, teléfono o email…"
              autoFocus
            />
            {isSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                Buscando…
              </span>
            )}
          </div>
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
          <div className="pt-2 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => { setRodaCustomerId(null); setRodaLinkedName(null); setStep('datos'); }}
            >
              <UserPlus className="h-4 w-4" />
              Crear cliente nuevo (sin vincular)
            </Button>
          </div>
        </div>
      )}

      {/* Step datos */}
      {step === 'datos' && (
        <div className="space-y-4">
          {rodaLinkedName && (
            <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
              <Link className="h-4 w-4 text-primary shrink-0" />
              <span>Vinculado a cliente RODA: <strong>{rodaLinkedName}</strong></span>
              <button
                className="ml-auto text-xs text-muted-foreground hover:text-foreground underline"
                onClick={() => { setRodaCustomerId(null); setRodaLinkedName(null); setStep('vincular'); }}
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
              placeholder="Nombre del cliente"
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
            <label className="block text-sm font-medium mb-2">Sexo</label>
            <div className="flex gap-2">
              {(['masculino', 'femenino', 'otro'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setSexo(s)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors capitalize
                    ${sexo === s ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Notas generales</label>
            <textarea
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background resize-none"
              rows={2} value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones relevantes…"
            />
          </div>
        </div>
      )}

      {/* Step entrenamiento */}
      {step === 'entrenamiento' && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">Nivel de entrenamiento</label>
            <div className="flex gap-2">
              {(['novato', 'intermedio', 'avanzado'] as const).map((n) => (
                <button
                  key={n}
                  onClick={() => setNivelEntrenamiento(n)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors capitalize
                    ${nivelEntrenamiento === n ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Objetivo principal</label>
            <div className="space-y-2">
              {OBJETIVOS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setObjetivoPrincipal(o.value)}
                  className={`w-full text-left rounded-md border px-3 py-2 text-sm font-medium transition-colors
                    ${objetivoPrincipal === o.value ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">¿Cuánto tiempo lleva entrenando?</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={tiempoEntrenando} onChange={(e) => setTiempoEntrenando(e.target.value)}
              placeholder="Ej: 2 años, 6 meses, nunca…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Deporte alterno (opcional)</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={deporteAlterno} onChange={(e) => setDeporteAlterno(e.target.value)}
              placeholder="Ej: fútbol, ciclismo, natación…"
            />
          </div>
        </div>
      )}

      {/* Step salud */}
      {step === 'salud' && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-2">¿Usa esteroides anabólicos?</label>
            <div className="flex gap-2">
              <button
                onClick={() => setUsaEsteroides(true)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors
                  ${usaEsteroides ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}
              >
                Sí
              </button>
              <button
                onClick={() => setUsaEsteroides(false)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors
                  ${!usaEsteroides ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}
              >
                No
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Problema cardiovascular (opcional)</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={problemaCardiovascular} onChange={(e) => setProblemaCardiovascular(e.target.value)}
              placeholder="Ej: hipertensión, arritmia…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Lesión actual (opcional)</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={lesionActual} onChange={(e) => setLesionActual(e.target.value)}
              placeholder="Ej: tendinitis hombro derecho…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-2">Zona a mejorar (opcional)</label>
            <div className="flex flex-wrap gap-2">
              {ZONAS_MEJORAR.map((z) => (
                <button
                  key={z}
                  onClick={() => setZonaAMejorar((prev) => prev === z ? '' : z)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors
                    ${zonaAMejorar === z ? 'border-primary bg-primary/10 text-primary' : 'hover:bg-muted'}`}
                >
                  {z}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Step plan */}
      {step === 'plan' && (
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">Horario laboral (opcional)</label>
            <input
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
              value={horarioLaboral} onChange={(e) => setHorarioLaboral(e.target.value)}
              placeholder="Ej: 9am–6pm, turnos rotativos…"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Se despierta</label>
              <input
                type="time"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                value={horaDespertar} onChange={(e) => setHoraDespertar(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Se duerme</label>
              <input
                type="time"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                value={horaDormir} onChange={(e) => setHoraDormir(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Entrena</label>
              <input
                type="time"
                className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-background"
                value={horaEntrenar} onChange={(e) => setHoraEntrenar(e.target.value)}
              />
            </div>
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
            {loading ? 'Guardando…' : 'Crear cliente'}
            {!loading && <Check className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}
