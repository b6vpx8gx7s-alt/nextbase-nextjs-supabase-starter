'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { NutritionPlan, NutritionMeal } from '@/lib/nutrition-types'
import { exportPlanToPDF } from '@/lib/nutrition-pdf'

interface PlanHistoryProps {
  onNew: () => void
  onView: (plan: NutritionPlan) => void
  onEdit: (plan: NutritionPlan) => void
  refreshTrigger?: number
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function PlanHistory({ onNew, onView, onEdit, refreshTrigger }: PlanHistoryProps) {
  const [plans, setPlans] = useState<NutritionPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null)
  const [pdfState, setPdfState] = useState<Record<string, 'loading' | 'done' | 'error'>>({})
  const [error, setError] = useState('')
  const [userRole, setUserRole] = useState<'owner' | 'employee' | null>(null)

  // Fetch role once — determines whether to show "created by" badges
  useEffect(() => {
    fetch('/api/nutrition/user-context')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.role) setUserRole(d.role) })
      .catch(() => {})
  }, [])

  const fetchPlans = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const r = await fetch('/api/nutrition/plans')
      if (!r.ok) throw new Error('Error al cargar planes')
      setPlans(await r.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchPlans() }, [fetchPlans, refreshTrigger])

  async function handleDuplicate(plan: NutritionPlan) {
    setIsDuplicating(plan.id)
    try {
      // Create duplicate plan
      const r = await fetch('/api/nutrition/plans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_name: `${plan.client_name} (copia)`,
          client_phone: plan.client_phone,
          client_email: plan.client_email,
          client_document: plan.client_document,
          duration_days: plan.duration_days,
          notes: plan.notes,
        }),
      })
      if (!r.ok) throw new Error('Error al duplicar')
      const newPlan: NutritionPlan = await r.json()

      // Copy meals
      const mealsR = await fetch(`/api/nutrition/meals/${plan.id}`)
      if (mealsR.ok) {
        const meals = await mealsR.json()
        if (meals.length > 0) {
          await fetch('/api/nutrition/meals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ plan_id: newPlan.id, meals }),
          })
        }
      }
      await fetchPlans()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al duplicar')
    } finally {
      setIsDuplicating(null)
    }
  }

  async function handleDownloadPDF(plan: NutritionPlan) {
    if (pdfState[plan.id] === 'loading') return
    setPdfState(prev => ({ ...prev, [plan.id]: 'loading' }))
    try {
      const r = await fetch(`/api/nutrition/meals/${plan.id}`)
      const meals: NutritionMeal[] = r.ok ? await r.json() : []
      await exportPlanToPDF(plan, meals)
      setPdfState(prev => ({ ...prev, [plan.id]: 'done' }))
      setTimeout(() => setPdfState(prev => { const next = { ...prev }; delete next[plan.id]; return next }), 3000)
    } catch {
      setPdfState(prev => ({ ...prev, [plan.id]: 'error' }))
      setTimeout(() => setPdfState(prev => { const next = { ...prev }; delete next[plan.id]; return next }), 4000)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Planes nutricionales</h2>
        <Button onClick={onNew}>+ Nuevo plan</Button>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-3">No hay planes creados aún.</p>
          <Button onClick={onNew}>Crear primer plan</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map(plan => (
            <Card key={plan.id} className="hover:shadow-sm transition-shadow">
              <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium truncate">{plan.client_name}</span>
                    {plan.client_document && (
                      <span className="text-xs text-muted-foreground">CC: {plan.client_document}</span>
                    )}
                    <Badge variant="secondary">{plan.duration_days} día{plan.duration_days !== 1 ? 's' : ''}</Badge>
                    {/* Owner sees who created each plan */}
                    {userRole === 'owner' && plan.created_by && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#3DD9B0]/15 text-[#1B8BA8] border border-[#3DD9B0]/30">
                        👤 Empleado
                      </span>
                    )}
                    {userRole === 'owner' && !plan.created_by && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                        🏢 Propietario
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                    {plan.client_phone && <span>{plan.client_phone}</span>}
                    {plan.client_email && <span>{plan.client_email}</span>}
                    <span>Creado {formatDate(plan.created_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap shrink-0">
                  <Button size="sm" variant="outline" onClick={() => onView(plan)}>
                    Ver
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onEdit(plan)}>
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isDuplicating === plan.id}
                    onClick={() => handleDuplicate(plan)}
                  >
                    {isDuplicating === plan.id ? '...' : 'Duplicar'}
                  </Button>
                  <Button
                    size="sm"
                    variant={pdfState[plan.id] === 'error' ? 'destructive' : 'outline'}
                    disabled={pdfState[plan.id] === 'loading'}
                    onClick={() => handleDownloadPDF(plan)}
                    title="Descargar PDF"
                  >
                    {pdfState[plan.id] === 'loading' && (
                      <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                    )}
                    {pdfState[plan.id] === 'loading' && 'PDF...'}
                    {pdfState[plan.id] === 'done' && '✓ PDF'}
                    {pdfState[plan.id] === 'error' && '✗ Error'}
                    {!pdfState[plan.id] && '📥 PDF'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
