'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { NutritionPlan, NutritionMeal } from '@/lib/nutrition-types'
import { exportPlanToPDF } from '@/lib/nutrition-pdf'

interface PlanDetailProps {
  plan: NutritionPlan
  onBack: () => void
  onEdit: (plan: NutritionPlan) => void
}

type MealType = 'breakfast' | 'lunch' | 'snack' | 'dinner'
const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Desayuno',
  lunch: 'Almuerzo',
  snack: 'Merienda',
  dinner: 'Cena',
}
const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'snack', 'dinner']

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function PlanDetail({ plan, onBack, onEdit }: PlanDetailProps) {
  const [meals, setMeals] = useState<NutritionMeal[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [pdfState, setPdfState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  useEffect(() => {
    async function fetchMeals() {
      setIsLoading(true)
      setError('')
      try {
        const r = await fetch(`/api/nutrition/meals/${plan.id}`)
        if (!r.ok) throw new Error('Error al cargar comidas')
        setMeals(await r.json())
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error')
      } finally {
        setIsLoading(false)
      }
    }
    fetchMeals()
  }, [plan.id])

  function getMeal(day: number, type: MealType): NutritionMeal | undefined {
    return meals.find(m => m.day === day && m.meal_type === type)
  }

  function getDayTotals(day: number) {
    return MEAL_TYPES.reduce(
      (acc, type) => {
        const m = getMeal(day, type)
        const macros = m?.macros
        if (!macros) return acc
        return {
          calories: acc.calories + macros.calories,
          protein: Math.round((acc.protein + macros.protein) * 10) / 10,
          carbs: Math.round((acc.carbs + macros.carbs) * 10) / 10,
          fat: Math.round((acc.fat + macros.fat) * 10) / 10,
        }
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
  }

  function getTotalMacros() {
    return Array.from({ length: plan.duration_days }, (_, i) => i + 1).reduce(
      (acc, d) => {
        const day = getDayTotals(d)
        return {
          calories: acc.calories + day.calories,
          protein: Math.round((acc.protein + day.protein) * 10) / 10,
          carbs: Math.round((acc.carbs + day.carbs) * 10) / 10,
          fat: Math.round((acc.fat + day.fat) * 10) / 10,
        }
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
  }

  async function handlePDF() {
    if (pdfState === 'loading') return
    setPdfState('loading')
    try {
      await exportPlanToPDF(plan, meals)
      setPdfState('done')
      setTimeout(() => setPdfState('idle'), 3000)
    } catch {
      setPdfState('error')
      setTimeout(() => setPdfState('idle'), 4000)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-24 bg-muted rounded-lg animate-pulse" />
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
      </div>
    )
  }

  const totalMacros = getTotalMacros()
  const avgCalories = plan.duration_days > 0 ? Math.round(totalMacros.calories / plan.duration_days) : 0

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          ← Volver
        </button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onEdit(plan)}>Editar</Button>
          <Button
            onClick={handlePDF}
            disabled={pdfState === 'loading'}
            variant={pdfState === 'error' ? 'destructive' : 'default'}
          >
            {pdfState === 'loading' && (
              <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
            )}
            {pdfState === 'loading' && 'Generando PDF...'}
            {pdfState === 'done' && '✓ Descargado'}
            {pdfState === 'error' && 'Error — reintentar'}
            {pdfState === 'idle' && '📥 Descargar PDF'}
          </Button>
        </div>
      </div>

      {/* Client info */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-4 items-start">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold">{plan.client_name}</h2>
              <div className="flex flex-wrap gap-3 mt-1 text-sm text-muted-foreground">
                {plan.client_document && <span>Doc: {plan.client_document}</span>}
                {plan.client_phone && <span>{plan.client_phone}</span>}
                {plan.client_email && <span>{plan.client_email}</span>}
                <span>Creado: {formatDate(plan.created_at)}</span>
              </div>
            </div>
            <Badge className="text-sm">{plan.duration_days} días</Badge>
          </div>

          {/* Total macros */}
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
            {[
              { label: 'Total kcal', value: totalMacros.calories, color: 'text-orange-600 dark:text-orange-400' },
              { label: 'Prom/día', value: `${avgCalories} kcal`, color: 'text-blue-600 dark:text-blue-400' },
              { label: 'Proteína', value: `${totalMacros.protein}g`, color: 'text-green-600 dark:text-green-400' },
              { label: 'Carboh.', value: `${totalMacros.carbs}g`, color: 'text-yellow-600 dark:text-yellow-400' },
              { label: 'Grasas', value: `${totalMacros.fat}g`, color: 'text-purple-600 dark:text-purple-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-lg bg-muted p-2 text-center">
                <div className={`text-lg font-bold ${color}`}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {/* Days */}
      {Array.from({ length: plan.duration_days }, (_, i) => i + 1).map(day => {
        const dayTotals = getDayTotals(day)
        return (
          <Card key={day}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="text-base">Día {day}</CardTitle>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{dayTotals.calories} kcal</span>
                  <span>P: {dayTotals.protein}g</span>
                  <span>C: {dayTotals.carbs}g</span>
                  <span>G: {dayTotals.fat}g</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {MEAL_TYPES.map(type => {
                const meal = getMeal(day, type)
                return (
                  <div key={type}>
                    <div className="text-sm font-medium text-muted-foreground mb-1 flex items-center gap-2">
                      {MEAL_LABELS[type]}
                      {meal?.macros && (
                        <span className="text-xs font-normal">
                          {meal.macros.calories} kcal · P:{meal.macros.protein}g · C:{meal.macros.carbs}g · G:{meal.macros.fat}g
                        </span>
                      )}
                    </div>
                    {meal?.foods && meal.foods.length > 0 ? (
                      <div className="space-y-0.5">
                        {meal.foods.map((f, idx) => (
                          <div key={idx} className="flex items-center justify-between text-sm px-2 py-0.5 rounded hover:bg-muted/50">
                            <span>{f.name}</span>
                            <span className="text-muted-foreground text-xs">{f.quantity}{f.unit}</span>
                          </div>
                        ))}
                        {meal.notes && (
                          <div className="text-xs text-muted-foreground italic px-2 pt-1">{meal.notes}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground px-2 py-1">Sin alimentos</div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )
      })}

      {/* Clinical notes */}
      {plan.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notas clínicas</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-wrap">{plan.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
