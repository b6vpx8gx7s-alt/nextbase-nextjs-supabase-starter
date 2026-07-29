'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { NutritionPlan, NutritionMeal } from '@/lib/nutrition-types'
import { Food, searchFoods } from '@/lib/foods-data'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SelectedFood {
  foodId: string
  name: string
  quantity: number
  unit: string
  calories: number
  protein: number
  carbs: number
  fat: number
  customFood?: boolean
}

interface CustomFoodForm {
  targetDay: number
  targetType: MealType
  name: string
  calories: string
  protein: string
  carbs: string
  fat: string
  quantity: string
}

interface UsdaFoodResult {
  fdcId: number
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
  incomplete: boolean
}

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'

interface MealData {
  foods: SelectedFood[]
  notes: string
}

interface Macros {
  calories: number
  protein: number
  carbs: number
  fat: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MEDICAL_CONDITIONS_LIST = [
  'Diabetes',
  'Hipertensión (presión alta)',
  'Colesterol alto',
  'Problemas de tiroides',
  'Insuficiencia renal',
  'Enfermedad hepática',
]
const MEDICAL_CONDITIONS_SET = new Set(MEDICAL_CONDITIONS_LIST)

const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Merienda',
  dinner: 'Cena',
}
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']
const DAY_OPTIONS = [1, 2, 3, 4, 5, 7, 14, 21, 30]
const USDA_SEARCH_URL = '/api/nutrition/search-usda'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mealKey(day: number, type: MealType): string {
  return `${day}-${type}`
}

function calcFoodMacros(food: Food, qty: number): Macros {
  const f = qty / 100
  return {
    calories: Math.round(food.calories * f),
    protein: Math.round(food.protein * f * 10) / 10,
    carbs: Math.round(food.carbs * f * 10) / 10,
    fat: Math.round(food.fat * f * 10) / 10,
  }
}

function calcCustomMacros(form: CustomFoodForm): Macros {
  const f = (parseFloat(form.quantity) || 0) / 100
  return {
    calories: Math.round((parseFloat(form.calories) || 0) * f),
    protein: Math.round((parseFloat(form.protein) || 0) * f * 10) / 10,
    carbs: Math.round((parseFloat(form.carbs) || 0) * f * 10) / 10,
    fat: Math.round((parseFloat(form.fat) || 0) * f * 10) / 10,
  }
}

function sumMacros(items: SelectedFood[]): Macros {
  return items.reduce(
    (acc, item) => ({
      calories: acc.calories + item.calories,
      protein: Math.round((acc.protein + item.protein) * 10) / 10,
      carbs: Math.round((acc.carbs + item.carbs) * 10) / 10,
      fat: Math.round((acc.fat + item.fat) * 10) / 10,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  )
}

function macroLine(m: Macros) {
  return `${m.calories} kcal · P:${m.protein}g · C:${m.carbs}g · G:${m.fat}g`
}

function calcIMC(
  weight_kg: string,
  height_cm: string,
): 'normal' | 'sobrepeso' | 'bajo_peso' | 'obeso' | null {
  const w = parseFloat(weight_kg)
  const h = parseFloat(height_cm) / 100
  if (!w || !h || h <= 0) return null
  const imc = w / (h * h)
  if (imc < 18.5) return 'bajo_peso'
  if (imc < 25)   return 'normal'
  if (imc < 30)   return 'sobrepeso'
  return 'obeso'
}


// ─── Component ────────────────────────────────────────────────────────────────

interface PlanEditorProps {
  initialPlan?: NutritionPlan & { meals?: NutritionMeal[] }
  onSave: (plan: NutritionPlan) => void
  onCancel: () => void
}

export function PlanEditor({ initialPlan, onSave, onCancel }: PlanEditorProps) {
  // Client fields
  const [clientName, setClientName] = useState(initialPlan?.client_name ?? '')
  const [clientPhone, setClientPhone] = useState(initialPlan?.client_phone ?? '')
  const [clientEmail, setClientEmail] = useState(initialPlan?.client_email ?? '')
  const [clientDocument, setClientDocument] = useState(initialPlan?.client_document ?? '')
  const [selectedDays, setSelectedDays] = useState(initialPlan?.duration_days ?? 5)
  const [clinicalNotes, setClinicalNotes] = useState(initialPlan?.notes ?? '')

  // Patient info state
  const _pi = initialPlan?.patient_info
  const [patientInfo, setPatientInfo] = useState({
    age:           _pi?.age?.toString()                 ?? '',
    weight_kg:     _pi?.weight_kg?.toString()           ?? '',
    height_cm:     _pi?.height_cm?.toString()           ?? '',
    objective:     _pi?.objective                       ?? '',
    restrictions:  (_pi?.restrictions ?? []).join(', ') ?? '',
    allergies:     _pi?.allergies                       ?? '',
    activity_level: _pi?.activity_level                 ?? '',
  })
  const [medicalConditions, setMedicalConditions] = useState<string[]>(
    () => (_pi?.medical_conditions ?? []).filter(c => MEDICAL_CONDITIONS_SET.has(c))
  )
  const [medicalConditionOther, setMedicalConditionOther] = useState(
    () => (_pi?.medical_conditions ?? []).find(c => !MEDICAL_CONDITIONS_SET.has(c)) ?? ''
  )

  // Meals state
  const [selectedMeals, setSelectedMeals] = useState<Record<string, MealData>>(() => {
    if (!initialPlan?.meals) return {}
    const m: Record<string, MealData> = {}
    for (const meal of initialPlan.meals) {
      m[mealKey(meal.day, meal.meal_type)] = {
        foods: (meal.foods ?? []).map(f => ({
          foodId: f.name,
          name: f.name,
          quantity: f.quantity,
          unit: f.unit,
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          customFood: f.customFood,
        })),
        notes: meal.notes ?? '',
      }
    }
    return m
  })

  // Food search state
  const [activeDay, setActiveDay] = useState('1')
  const [activeMealKey, setActiveMealKey] = useState<string | null>(null)
  const [foodQuery, setFoodQuery] = useState('')
  const [foodResults, setFoodResults] = useState<Food[]>([])
  const [pendingFood, setPendingFood] = useState<{ food: Food; qty: string } | null>(null)

  // Custom food modal
  const [customForm, setCustomForm] = useState<CustomFoodForm | null>(null)
  const [customError, setCustomError] = useState('')

  // User context (role + employeeId)
  const [userRole, setUserRole] = useState<'owner' | 'employee' | null>(null)
  const [userEmployeeId, setUserEmployeeId] = useState<string | null>(null)

  // USDA search (lives inside custom modal)
  const [usdaOpen, setUsdaOpen] = useState(false)
  const [usdaQuery, setUsdaQuery] = useState('')
  const [usdaResults, setUsdaResults] = useState<UsdaFoodResult[]>([])
  const [usdaLoading, setUsdaLoading] = useState(false)
  const [usdaError, setUsdaError] = useState('')

  // Save state
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const searchRef = useRef<HTMLDivElement>(null)

  // Fetch user role once on mount (for UI indicator only — server always re-derives it)
  useEffect(() => {
    fetch('/api/nutrition/user-context')
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d) {
          setUserRole(d.role)
          setUserEmployeeId(d.employeeId ?? null)
        }
      })
      .catch(() => { /* non-critical */ })
  }, [])

  // Update local food results on query change
  useEffect(() => {
    setFoodResults(searchFoods(foodQuery))
  }, [foodQuery])

  // Close search panel when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setActiveMealKey(null)
        setFoodQuery('')
        setPendingFood(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // USDA debounced search — runs 300ms after usdaQuery changes
  useEffect(() => {
    if (!usdaOpen || !usdaQuery.trim()) {
      setUsdaResults([])
      setUsdaError('')
      setUsdaLoading(false)
      return
    }

    const controller = new AbortController()
    setUsdaLoading(true)
    setUsdaError('')

    const timer = setTimeout(async () => {
      try {
        const url = `${USDA_SEARCH_URL}?query=${encodeURIComponent(usdaQuery)}`
        const res = await fetch(url, { signal: controller.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? `Error ${res.status}`)

        const foods: UsdaFoodResult[] = Array.isArray(data) ? data : []
        setUsdaResults(foods)
        if (foods.length === 0) setUsdaError('Sin resultados. Prueba otra búsqueda.')
      } catch (e: unknown) {
        if (e instanceof Error && e.name !== 'AbortError') {
          setUsdaError('Sin conexión con USDA. Ingresa los macros manualmente.')
        }
      } finally {
        setUsdaLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [usdaQuery, usdaOpen])

  // ── Meal helpers ────────────────────────────────────────────────────────────

  function getMealData(day: number, type: MealType): MealData {
    return selectedMeals[mealKey(day, type)] ?? { foods: [], notes: '' }
  }

  function setMealData(day: number, type: MealType, data: MealData) {
    setSelectedMeals(prev => ({ ...prev, [mealKey(day, type)]: data }))
  }

  function getDayMacros(day: number): Macros {
    return MEAL_TYPES.reduce(
      (acc, t) => {
        const m = sumMacros(getMealData(day, t).foods)
        return {
          calories: acc.calories + m.calories,
          protein: Math.round((acc.protein + m.protein) * 10) / 10,
          carbs: Math.round((acc.carbs + m.carbs) * 10) / 10,
          fat: Math.round((acc.fat + m.fat) * 10) / 10,
        }
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
  }

  // ── Food search actions ─────────────────────────────────────────────────────

  function toggleFoodSearch(day: number, type: MealType) {
    const k = mealKey(day, type)
    if (activeMealKey === k) {
      setActiveMealKey(null)
      setFoodQuery('')
      setPendingFood(null)
    } else {
      setActiveMealKey(k)
      setFoodQuery('')
      setPendingFood(null)
    }
  }

  function selectFood(food: Food) {
    setPendingFood({ food, qty: '100' })
    setFoodQuery(food.name)
    setFoodResults([])
  }

  function confirmFood(day: number, type: MealType) {
    if (!pendingFood) return
    const qty = parseFloat(pendingFood.qty)
    if (isNaN(qty) || qty <= 0) return
    const entry: SelectedFood = {
      foodId: pendingFood.food.id,
      name: pendingFood.food.name,
      quantity: qty,
      unit: pendingFood.food.unit,
      ...calcFoodMacros(pendingFood.food, qty),
    }
    const meal = getMealData(day, type)
    setMealData(day, type, { ...meal, foods: [...meal.foods, entry] })
    setPendingFood(null)
    setFoodQuery('')
    setActiveMealKey(null)
  }

  function removeFood(day: number, type: MealType, index: number) {
    const meal = getMealData(day, type)
    setMealData(day, type, { ...meal, foods: meal.foods.filter((_, i) => i !== index) })
  }

  // ── Custom food modal ───────────────────────────────────────────────────────

  function openCustomModal(day: number, type: MealType) {
    setCustomError('')
    setUsdaOpen(false)
    setUsdaQuery('')
    setUsdaResults([])
    setUsdaError('')
    setCustomForm({
      targetDay: day,
      targetType: type,
      name: foodQuery.trim(),
      calories: '',
      protein: '',
      carbs: '',
      fat: '',
      quantity: '100',
    })
  }

  function closeCustomModal() {
    setCustomForm(null)
    setCustomError('')
    setUsdaOpen(false)
    setUsdaQuery('')
    setUsdaResults([])
    setUsdaError('')
  }

  function patchCustomForm(patch: Partial<CustomFoodForm>) {
    setCustomForm(prev => (prev ? { ...prev, ...patch } : null))
  }

  // Toggle USDA panel; pre-fill query from current food name
  const toggleUsdaPanel = useCallback(() => {
    setUsdaOpen(prev => {
      if (!prev) {
        // opening: pre-fill query with name
        setUsdaQuery(customForm?.name ?? '')
      }
      return !prev
    })
  }, [customForm?.name])

  // Apply selected USDA food: fill macros only (preserve user-typed name)
  function applyUsdaFood(food: UsdaFoodResult) {
    patchCustomForm({
      calories: String(food.calories),
      protein: String(food.protein),
      carbs: String(food.carbs),
      fat: String(food.fat),
    })
    setUsdaOpen(false)
    setUsdaQuery('')
    setUsdaResults([])
  }

  function confirmCustomFood() {
    if (!customForm) return
    if (!customForm.name.trim()) {
      setCustomError('El nombre es requerido')
      return
    }
    const qty = parseFloat(customForm.quantity)
    if (isNaN(qty) || qty <= 0) {
      setCustomError('La cantidad debe ser mayor a 0')
      return
    }
    const numericFields = [customForm.calories, customForm.protein, customForm.carbs, customForm.fat]
    if (numericFields.some(v => parseFloat(v) < 0)) {
      setCustomError('Los macros no pueden ser negativos')
      return
    }

    const totals = calcCustomMacros(customForm)
    const entry: SelectedFood = {
      foodId: `custom-${Date.now()}`,
      name: customForm.name.trim(),
      quantity: qty,
      unit: 'g',
      customFood: true,
      ...totals,
    }

    const meal = getMealData(customForm.targetDay, customForm.targetType)
    setMealData(customForm.targetDay, customForm.targetType, {
      ...meal,
      foods: [...meal.foods, entry],
    })

    closeCustomModal()
    setFoodQuery('')
    setActiveMealKey(null)
  }

  // ── Save plan ───────────────────────────────────────────────────────────────

  async function handleSave() {
    if (!clientName.trim()) { setError('El nombre del cliente es requerido'); return }
    setError('')
    setIsSaving(true)
    try {
      // Build patient info only if at least one field is filled
      const piPayload: Record<string, unknown> = {}
      if (patientInfo.age)          piPayload.age          = parseInt(patientInfo.age, 10)
      if (patientInfo.weight_kg)    piPayload.weight_kg    = parseFloat(patientInfo.weight_kg)
      if (patientInfo.height_cm)    piPayload.height_cm    = parseFloat(patientInfo.height_cm)
      if (patientInfo.objective)    piPayload.objective    = patientInfo.objective
      if (patientInfo.restrictions) piPayload.restrictions = patientInfo.restrictions.split(',').map(s => s.trim()).filter(Boolean)
      if (patientInfo.allergies)    piPayload.allergies    = patientInfo.allergies
      if (patientInfo.activity_level) piPayload.activity_level = patientInfo.activity_level

      const ns = calcIMC(patientInfo.weight_kg, patientInfo.height_cm)
      if (ns) piPayload.nutritional_status = ns

      const allConditions = [
        ...medicalConditions,
        ...(medicalConditionOther.trim() ? [medicalConditionOther.trim()] : []),
      ]
      if (allConditions.length > 0) piPayload.medical_conditions = allConditions

      const planPayload = {
        client_name:     clientName,
        client_phone:    clientPhone    || undefined,
        client_email:    clientEmail    || undefined,
        client_document: clientDocument || undefined,
        duration_days:   selectedDays,
        notes:           clinicalNotes  || undefined,
        patientInfo:     Object.keys(piPayload).length > 0 ? piPayload : undefined,
      }

      const pr = await fetch('/api/nutrition/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planPayload),
      })
      if (!pr.ok) throw new Error(await pr.text())
      const plan: NutritionPlan = await pr.json()

      const mealsPayload: Array<{
        day: number
        meal_type: MealType
        foods: { name: string; quantity: number; unit: string; customFood?: boolean }[]
        macros: Macros
        notes: string
      }> = []
      for (let d = 1; d <= selectedDays; d++) {
        for (const t of MEAL_TYPES) {
          const meal = getMealData(d, t)
          if (meal.foods.length > 0) {
            mealsPayload.push({
              day: d,
              meal_type: t,
              foods: meal.foods.map(f => ({
                name: f.name,
                quantity: f.quantity,
                unit: f.unit,
                customFood: f.customFood,
              })),
              macros: sumMacros(meal.foods),
              notes: meal.notes,
            })
          }
        }
      }

      const mr = await fetch('/api/nutrition/meals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: plan.id, meals: mealsPayload }),
      })
      if (!mr.ok) throw new Error(await mr.text())

      onSave(plan)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setIsSaving(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  const days = Array.from({ length: selectedDays }, (_, i) => i + 1)
  const hasCustomMacros =
    customForm &&
    (customForm.calories || customForm.protein || customForm.carbs || customForm.fat)

  return (
    <>
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Client Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datos del cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nombre completo *</label>
                <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="Ej: María García" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Documento</label>
                <Input value={clientDocument} onChange={e => setClientDocument(e.target.value)} placeholder="CC / TI / CE" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Teléfono</label>
                <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="300 000 0000" />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Email</label>
                <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="cliente@email.com" type="email" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Duración del plan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {DAY_OPTIONS.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDays(d)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                    selectedDays === d
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:bg-accent'
                  }`}
                >
                  {d === 1 ? '1 día' : `${d} días`}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Patient Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Información del paciente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">Edad</label>
                  <Input
                    type="number" min="0" max="120" placeholder="Años"
                    value={patientInfo.age}
                    onChange={e => setPatientInfo(prev => ({ ...prev, age: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Peso (kg)</label>
                  <Input
                    type="number" min="0" step="0.1" placeholder="65.5"
                    value={patientInfo.weight_kg}
                    onChange={e => setPatientInfo(prev => ({ ...prev, weight_kg: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium">Altura (cm)</label>
                  <Input
                    type="number" min="0" placeholder="170"
                    value={patientInfo.height_cm}
                    onChange={e => setPatientInfo(prev => ({ ...prev, height_cm: e.target.value }))}
                  />
                </div>
              </div>
              {/* IMC badge — shown once weight + height are both entered */}
              {(() => {
                const ns = calcIMC(patientInfo.weight_kg, patientInfo.height_cm)
                if (!ns) return null
                const w = parseFloat(patientInfo.weight_kg)
                const h = parseFloat(patientInfo.height_cm) / 100
                const imc = (w / (h * h)).toFixed(1)
                const cfg = {
                  normal:      { label: '✓ Normal',    cls: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
                  bajo_peso:   { label: '↓ Bajo peso',  cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
                  sobrepeso:   { label: '⚠ Sobrepeso',  cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
                  obeso:       { label: '⚠ Obesidad',   cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
                }[ns]
                return (
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full ${cfg.cls}`}>
                      {cfg.label}
                    </span>
                    <span className="text-xs text-muted-foreground">IMC: {imc}</span>
                  </div>
                )
              })()}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium">Nivel de actividad</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={patientInfo.activity_level}
                  onChange={e => setPatientInfo(prev => ({ ...prev, activity_level: e.target.value }))}
                >
                  <option value="">Seleccionar...</option>
                  <option value="sedentario">Sedentario (&lt;1h/semana)</option>
                  <option value="moderado">Moderado (2–3h/semana)</option>
                  <option value="activo">Activo (4–5h/semana)</option>
                  <option value="muy_activo">Muy activo (6+h o trabajo físico)</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium">Objetivo</label>
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={patientInfo.objective}
                  onChange={e => setPatientInfo(prev => ({ ...prev, objective: e.target.value }))}
                >
                  <option value="">Seleccionar...</option>
                  <option value="bajar_peso">Bajar de peso</option>
                  <option value="ganar_musculo">Ganar músculo</option>
                  <option value="mantenimiento">Mantenimiento</option>
                  <option value="otro">Otro</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Restricciones dietarias</label>
              <Textarea
                placeholder="Ej: vegetariano, sin gluten, sin lactosa (separar con comas)"
                rows={2}
                value={patientInfo.restrictions}
                onChange={e => setPatientInfo(prev => ({ ...prev, restrictions: e.target.value }))}
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Alergias</label>
              <Textarea
                placeholder="Ej: mariscos, nueces, huevos"
                rows={2}
                value={patientInfo.allergies}
                onChange={e => setPatientInfo(prev => ({ ...prev, allergies: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Condiciones médicas</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-6">
                {MEDICAL_CONDITIONS_LIST.map(condition => (
                  <label key={condition} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-[#1B8BA8]"
                      checked={medicalConditions.includes(condition)}
                      onChange={e =>
                        setMedicalConditions(prev =>
                          e.target.checked ? [...prev, condition] : prev.filter(c => c !== condition)
                        )
                      }
                    />
                    <span className="text-sm">{condition}</span>
                  </label>
                ))}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input accent-[#1B8BA8]"
                    checked={medicalConditionOther.trim() !== ''}
                    onChange={e => { if (!e.target.checked) setMedicalConditionOther('') }}
                  />
                  <span className="text-sm text-muted-foreground">Otra</span>
                </label>
              </div>
              <Input
                placeholder="Especificar otra condición..."
                value={medicalConditionOther}
                onChange={e => setMedicalConditionOther(e.target.value)}
              />
            </div>

          </CardContent>
        </Card>

        {/* Meals per day */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Comidas por día</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={activeDay} onValueChange={setActiveDay}>
              <TabsList className="flex-wrap h-auto gap-1 mb-4">
                {days.map(d => (
                  <TabsTrigger key={d} value={String(d)}>Día {d}</TabsTrigger>
                ))}
              </TabsList>

              {days.map(d => {
                const dayTotals = getDayMacros(d)
                return (
                  <TabsContent key={d} value={String(d)} className="space-y-3">
                    {/* Day summary */}
                    <div className="flex flex-wrap gap-3 p-3 bg-muted rounded-lg text-sm">
                      <span className="font-medium">Total día {d}:</span>
                      <span className="text-orange-600 dark:text-orange-400 font-semibold">{dayTotals.calories} kcal</span>
                      <span>P: <strong>{dayTotals.protein}g</strong></span>
                      <span>C: <strong>{dayTotals.carbs}g</strong></span>
                      <span>G: <strong>{dayTotals.fat}g</strong></span>
                    </div>

                    {MEAL_TYPES.map(type => {
                      const meal = getMealData(d, type)
                      const mealMacros = sumMacros(meal.foods)
                      const key = mealKey(d, type)
                      const isActive = activeMealKey === key
                      const hasQuery = foodQuery.trim().length > 0
                      const showResults = isActive && hasQuery && foodResults.length > 0 && !pendingFood
                      const showNoMatch = isActive && hasQuery && foodResults.length === 0 && !pendingFood

                      return (
                        <div key={type} className="border rounded-lg">
                          {/* Meal header */}
                          <div className="flex items-center justify-between px-4 py-2 bg-muted/50 rounded-t-lg">
                            <span className="font-medium text-sm">{MEAL_LABELS[type]}</span>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {meal.foods.length > 0 && (
                                <>
                                  <span>{mealMacros.calories} kcal</span>
                                  <span>P:{mealMacros.protein}g</span>
                                  <span>C:{mealMacros.carbs}g</span>
                                  <span>G:{mealMacros.fat}g</span>
                                </>
                              )}
                              <Button size="sm" variant="outline" onClick={() => toggleFoodSearch(d, type)}>
                                + Alimento
                              </Button>
                            </div>
                          </div>

                          {/* Foods list */}
                          {meal.foods.length > 0 && (
                            <div className="divide-y">
                              {meal.foods.map((f, idx) => (
                                <div key={idx} className="flex items-center justify-between px-4 py-1.5 text-sm">
                                  <span className="flex items-center gap-1.5 min-w-0">
                                    <span className="truncate">{f.name}</span>
                                    {f.customFood && (
                                      <span className="text-xs px-1 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                                        custom
                                      </span>
                                    )}
                                    <span className="text-muted-foreground shrink-0">— {f.quantity}{f.unit}</span>
                                  </span>
                                  <div className="flex items-center gap-3 text-xs text-muted-foreground shrink-0 ml-2">
                                    <span>{f.calories} kcal</span>
                                    <span>P:{f.protein}g</span>
                                    <span>C:{f.carbs}g</span>
                                    <span>G:{f.fat}g</span>
                                    <button
                                      onClick={() => removeFood(d, type, idx)}
                                      className="text-destructive hover:text-destructive/80 ml-1"
                                    >
                                      ×
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Food search panel */}
                          {isActive && (
                            <div ref={searchRef} className="px-4 py-3 border-t bg-background space-y-2">
                              <div className="relative">
                                <Input
                                  autoFocus
                                  placeholder="Buscar alimento (ej: arroz, pollo, papa...)"
                                  value={foodQuery}
                                  onChange={e => {
                                    setFoodQuery(e.target.value)
                                    setPendingFood(null)
                                  }}
                                />

                                {/* Autocomplete dropdown */}
                                {showResults && (
                                  <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg max-h-72 overflow-y-auto">
                                    {foodResults.map(food => (
                                      <button
                                        key={food.id}
                                        className="w-full text-left px-3 py-2.5 text-sm hover:bg-accent flex items-center justify-between gap-2"
                                        onMouseDown={e => e.preventDefault()}
                                        onClick={() => selectFood(food)}
                                      >
                                        <div className="flex flex-col min-w-0">
                                          <span className="truncate">{food.name}</span>
                                          <span className="text-xs text-muted-foreground">{food.category}</span>
                                        </div>
                                        <span className="text-muted-foreground text-xs shrink-0">
                                          {food.calories} kcal/100{food.unit}
                                        </span>
                                      </button>
                                    ))}
                                  </div>
                                )}

                                {/* No match → add custom option */}
                                {showNoMatch && (
                                  <div className="absolute z-50 top-full mt-1 w-full bg-popover border rounded-md shadow-lg overflow-hidden">
                                    <button
                                      className="w-full text-left px-3 py-3 text-sm hover:bg-accent flex items-center gap-2.5 group"
                                      onMouseDown={e => e.preventDefault()}
                                      onClick={() => openCustomModal(d, type)}
                                    >
                                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-base font-bold group-hover:bg-primary/20">
                                        +
                                      </span>
                                      <span>
                                        Agregar{' '}
                                        <strong className="text-foreground">"{foodQuery}"</strong>{' '}
                                        como alimento personalizado
                                      </span>
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Pending food: quantity picker */}
                              {pendingFood && (
                                <>
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm flex-1 truncate">{pendingFood.food.name}</span>
                                    <Input
                                      type="number"
                                      min="1"
                                      className="w-24"
                                      value={pendingFood.qty}
                                      onChange={e => setPendingFood({ ...pendingFood, qty: e.target.value })}
                                      placeholder="100"
                                    />
                                    <span className="text-sm text-muted-foreground">{pendingFood.food.unit}</span>
                                    <Button size="sm" onClick={() => confirmFood(d, type)}>Agregar</Button>
                                    <Button size="sm" variant="ghost" onClick={() => setPendingFood(null)}>×</Button>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {macroLine(calcFoodMacros(pendingFood.food, parseFloat(pendingFood.qty) || 0))}
                                  </div>
                                </>
                              )}

                              {/* Meal notes */}
                              <Input
                                placeholder="Notas para esta comida (opcional)"
                                value={meal.notes}
                                onChange={e => setMealData(d, type, { ...meal, notes: e.target.value })}
                                className="text-sm"
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </TabsContent>
                )
              })}
            </Tabs>
          </CardContent>
        </Card>

        {/* Clinical Notes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas clínicas</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={clinicalNotes}
              onChange={e => setClinicalNotes(e.target.value)}
              placeholder="Observaciones, restricciones alimentarias, objetivos nutricionales..."
              rows={4}
            />
          </CardContent>
        </Card>

        {error && (
          <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
        )}

        {/* Role indicator */}
        {userRole && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
              userRole === 'employee'
                ? 'bg-[#3DD9B0]/15 text-[#1B8BA8]'
                : 'bg-muted text-muted-foreground'
            }`}>
              {userRole === 'employee' ? '👤 Empleado' : '🏢 Propietario'}
            </span>
            <span>
              {userRole === 'employee'
                ? 'Este plan quedará asignado a tu cuenta'
                : 'Creando como propietario del negocio'}
            </span>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={isSaving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Guardando...' : initialPlan ? 'Actualizar plan' : 'Guardar plan'}
          </Button>
        </div>
      </div>

      {/* ── Custom food modal ──────────────────────────────────────────────────── */}
      <Dialog open={customForm !== null} onOpenChange={open => { if (!open) closeCustomModal() }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alimento personalizado</DialogTitle>
            <DialogDescription>
              Ingresa los macros <strong>por 100g</strong> del alimento, o búscalo en USDA.
            </DialogDescription>
          </DialogHeader>

          {customForm && (
            <div className="space-y-4">
              {/* Name */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Nombre *</label>
                <Input
                  value={customForm.name}
                  onChange={e => patchCustomForm({ name: e.target.value })}
                  placeholder="Nombre del alimento"
                  autoFocus
                />
              </div>

              {/* ── USDA search accordion ──────────────────────────────────────── */}
              <div className="rounded-lg overflow-hidden border border-[#1B8BA8]/30">
                {/* Header toggle */}
                <button
                  type="button"
                  onClick={toggleUsdaPanel}
                  className="w-full flex items-center justify-between px-4 py-3 text-left gap-3 transition-colors bg-[#1B8BA8] hover:bg-[#176f89] text-white"
                >
                  <span className="flex items-center gap-2.5">
                    <Search className="h-4 w-4 shrink-0 text-white/80" />
                    <span className="font-semibold text-sm">Buscar en USDA FoodData</span>
                    <span className="text-xs text-white/60 font-normal hidden sm:inline">
                      autocompleta macros
                    </span>
                  </span>
                  <ChevronDown
                    className={`h-4 w-4 text-white/70 shrink-0 transition-transform duration-200 ${
                      usdaOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {usdaOpen && (
                  <div className="p-3 space-y-3 bg-[#1B8BA8]/5 border-t border-[#1B8BA8]/20">
                    {/* Search input */}
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#1B8BA8]/60 pointer-events-none" />
                      <Input
                        className="pl-8 text-sm border-[#1B8BA8]/30 focus-visible:ring-[#1B8BA8]/40 bg-white dark:bg-neutral-900"
                        placeholder="Buscar en inglés (ej: brown rice, chicken breast)"
                        value={usdaQuery}
                        onChange={e => setUsdaQuery(e.target.value)}
                        autoFocus
                      />
                    </div>

                    {/* Loading */}
                    {usdaLoading && (
                      <div className="flex items-center gap-2.5 px-1 py-2 text-xs text-[#1B8BA8]">
                        <span className="inline-block w-3.5 h-3.5 border-2 border-[#1B8BA8] border-t-transparent rounded-full animate-spin shrink-0" />
                        <span className="font-medium">Buscando en USDA...</span>
                      </div>
                    )}

                    {/* Error */}
                    {usdaError && !usdaLoading && (
                      <div className="flex items-start gap-2 px-3 py-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-400">
                        <span className="shrink-0 mt-0.5">⚠</span>
                        <span>{usdaError}</span>
                      </div>
                    )}

                    {/* Results */}
                    {usdaResults.length > 0 && !usdaLoading && (
                      <div
                        className="
                          rounded-md overflow-hidden border border-[#1B8BA8]/20
                          divide-y divide-[#1B8BA8]/10
                          max-h-56 overflow-y-auto
                          [&::-webkit-scrollbar]:w-1
                          [&::-webkit-scrollbar-track]:bg-transparent
                          [&::-webkit-scrollbar-thumb]:bg-[#1B8BA8]/30
                          [&::-webkit-scrollbar-thumb]:rounded-full
                          [&::-webkit-scrollbar-thumb:hover]:bg-[#1B8BA8]/50
                        "
                      >
                        {usdaResults.map(food => (
                          <button
                            key={food.fdcId}
                            type="button"
                            onClick={() => applyUsdaFood(food)}
                            className="
                              w-full text-left px-4 py-3 text-sm
                              bg-white dark:bg-neutral-900
                              hover:bg-[#3DD9B0]/15 dark:hover:bg-[#3DD9B0]/10
                              border-l-2 border-l-transparent
                              hover:border-l-[#3DD9B0]
                              transition-all duration-100
                              cursor-pointer
                            "
                          >
                            {/* Food name */}
                            <p className="font-semibold text-foreground truncate leading-snug">
                              {food.description}
                            </p>

                            {/* Macro pills */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-800/40">
                                🔥 {food.calories} kcal
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-400 border border-sky-200/60 dark:border-sky-800/40">
                                P {food.protein}g
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                                C {food.carbs}g
                              </span>
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200/60 dark:border-violet-800/40">
                                G {food.fat}g
                              </span>
                              {food.incomplete && (
                                <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200/60 dark:border-amber-800/40">
                                  ⚠ incompleto
                                </span>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Idle hint */}
                    {!usdaLoading && !usdaError && usdaResults.length === 0 && usdaQuery.trim() === '' && (
                      <div className="flex items-center justify-center gap-2 py-3 text-xs text-[#1B8BA8]/60">
                        <Search className="h-3.5 w-3.5" />
                        <span>Escribe para buscar · los macros se llenan solos al seleccionar</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Macros grid */}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Macros por 100g</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Calorías (kcal)</label>
                    <Input
                      type="number"
                      min="0"
                      value={customForm.calories}
                      onChange={e => patchCustomForm({ calories: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Proteína (g)</label>
                    <Input
                      type="number"
                      min="0"
                      value={customForm.protein}
                      onChange={e => patchCustomForm({ protein: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Carbos (g)</label>
                    <Input
                      type="number"
                      min="0"
                      value={customForm.carbs}
                      onChange={e => patchCustomForm({ carbs: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Grasas (g)</label>
                    <Input
                      type="number"
                      min="0"
                      value={customForm.fat}
                      onChange={e => patchCustomForm({ fat: e.target.value })}
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>

              {/* Quantity */}
              <div className="space-y-1">
                <label className="text-sm font-medium">Cantidad a consumir (g)</label>
                <Input
                  type="number"
                  min="1"
                  value={customForm.quantity}
                  onChange={e => patchCustomForm({ quantity: e.target.value })}
                  placeholder="100"
                />
              </div>

              {/* Live macro preview */}
              {hasCustomMacros && (
                <div className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    Total para {customForm.quantity || 0}g:{' '}
                  </span>
                  {macroLine(calcCustomMacros(customForm))}
                </div>
              )}

              {customError && (
                <p className="text-sm text-destructive">{customError}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeCustomModal}>Cancelar</Button>
            <Button onClick={confirmCustomFood}>Agregar alimento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
