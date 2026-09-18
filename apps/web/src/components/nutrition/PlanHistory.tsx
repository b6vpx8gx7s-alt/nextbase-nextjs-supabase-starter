'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ChevronDown } from 'lucide-react'
import { NutritionPlan, NutritionMeal } from '@/lib/nutrition-types'
import { exportPlanToPDF } from '@/lib/nutrition-pdf'

interface PlanHistoryProps {
  onNew: () => void
  onView: (plan: NutritionPlan) => void
  onEdit: (plan: NutritionPlan) => void
  refreshTrigger?: number
  businessName?: string | null
}

// A version family: the root plan + all direct children, sorted version desc
interface PlanFamily {
  rootId: string
  versions: NutritionPlan[]  // index 0 = latest version
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

function groupIntoFamilies(plans: NutritionPlan[]): PlanFamily[] {
  const roots = plans.filter(p => !p.parent_plan_id)
  const childrenByParent = new Map<string, NutritionPlan[]>()
  for (const p of plans) {
    if (!p.parent_plan_id) continue
    const arr = childrenByParent.get(p.parent_plan_id) ?? []
    arr.push(p)
    childrenByParent.set(p.parent_plan_id, arr)
  }

  const families: PlanFamily[] = roots.map(root => {
    const all = [root, ...(childrenByParent.get(root.id) ?? [])]
    all.sort((a, b) => (b.version ?? 1) - (a.version ?? 1))
    return { rootId: root.id, versions: all }
  })

  // Sort families by most recent version's created_at
  families.sort((a, b) =>
    new Date(b.versions[0].created_at).getTime() - new Date(a.versions[0].created_at).getTime()
  )
  return families
}

export function PlanHistory({ onNew, onView, onEdit, refreshTrigger, businessName }: PlanHistoryProps) {
  const [plans, setPlans] = useState<NutritionPlan[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDuplicating, setIsDuplicating] = useState<string | null>(null)
  const [pdfState, setPdfState] = useState<Record<string, 'loading' | 'done' | 'error'>>({})
  const [error, setError] = useState('')
  const [userRole, setUserRole] = useState<'owner' | 'employee' | null>(null)
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set())

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

  function toggleFamily(rootId: string) {
    setExpandedFamilies(prev => {
      const next = new Set(prev)
      if (next.has(rootId)) next.delete(rootId)
      else next.add(rootId)
      return next
    })
  }

  async function handleDuplicate(plan: NutritionPlan) {
    setIsDuplicating(plan.id)
    try {
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
          // Duplicate starts a fresh version chain (no parent_plan_id)
        }),
      })
      if (!r.ok) throw new Error('Error al duplicar')
      const newPlan: NutritionPlan = await r.json()

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
      await exportPlanToPDF(plan, meals, businessName)
      setPdfState(prev => ({ ...prev, [plan.id]: 'done' }))
      setTimeout(() => setPdfState(prev => { const next = { ...prev }; delete next[plan.id]; return next }), 3000)
    } catch {
      setPdfState(prev => ({ ...prev, [plan.id]: 'error' }))
      setTimeout(() => setPdfState(prev => { const next = { ...prev }; delete next[plan.id]; return next }), 4000)
    }
  }

  const families = groupIntoFamilies(plans)

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
      ) : families.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="mb-3">No hay planes creados aún.</p>
          <Button onClick={onNew}>Crear primer plan</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {families.map(family => {
            const latest = family.versions[0]
            const hasHistory = family.versions.length > 1
            const isExpanded = expandedFamilies.has(family.rootId)

            return (
              <Card key={family.rootId} className="hover:shadow-sm transition-shadow">
                {/* Latest version row */}
                <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{latest.client_name}</span>
                      {latest.client_document && (
                        <span className="text-xs text-muted-foreground">CC: {latest.client_document}</span>
                      )}
                      <Badge variant="secondary">{latest.duration_days} día{latest.duration_days !== 1 ? 's' : ''}</Badge>
                      {hasHistory && (
                        <Badge variant="outline" className="text-[11px] px-1.5 py-0 font-semibold">
                          v{latest.version ?? 1}
                        </Badge>
                      )}
                      {userRole === 'owner' && latest.created_by && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#3DD9B0]/15 text-[#1B8BA8] border border-[#3DD9B0]/30">
                          👤 Empleado
                        </span>
                      )}
                      {userRole === 'owner' && !latest.created_by && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          🏢 Propietario
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                      {latest.client_phone && <span>{latest.client_phone}</span>}
                      {latest.client_email && <span>{latest.client_email}</span>}
                      <span>Actualizado {formatDate(latest.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap shrink-0">
                    <Button size="sm" variant="outline" onClick={() => onView(latest)}>Ver</Button>
                    <Button size="sm" variant="outline" onClick={() => onEdit(latest)}>Editar</Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isDuplicating === latest.id}
                      onClick={() => handleDuplicate(latest)}
                    >
                      {isDuplicating === latest.id ? '...' : 'Duplicar'}
                    </Button>
                    <Button
                      size="sm"
                      variant={pdfState[latest.id] === 'error' ? 'destructive' : 'outline'}
                      disabled={pdfState[latest.id] === 'loading'}
                      onClick={() => handleDownloadPDF(latest)}
                    >
                      {pdfState[latest.id] === 'loading' && (
                        <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                      )}
                      {pdfState[latest.id] === 'loading' ? 'PDF...' :
                       pdfState[latest.id] === 'done'    ? '✓ PDF' :
                       pdfState[latest.id] === 'error'   ? '✗ Error' : '📥 PDF'}
                    </Button>
                  </div>
                </CardContent>

                {/* History toggle */}
                {hasHistory && (
                  <>
                    <button
                      onClick={() => toggleFamily(family.rootId)}
                      className="w-full flex items-center gap-1.5 px-4 pb-3 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                      />
                      {isExpanded
                        ? 'Ocultar historial'
                        : `Ver historial (${family.versions.length} versiones)`}
                    </button>

                    {isExpanded && (
                      <div className="border-t mx-4 mb-3 pt-3 space-y-2">
                        {family.versions.slice(1).map(ver => (
                          <div
                            key={ver.id}
                            className="flex items-center gap-2 text-sm text-muted-foreground pl-1"
                          >
                            <span className="text-[11px] font-semibold text-muted-foreground/70 w-6 shrink-0">
                              v{ver.version ?? 1}
                            </span>
                            <span className="flex-1">{formatDate(ver.created_at)}</span>
                            <div className="flex gap-1.5 shrink-0">
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onView(ver)}>
                                Ver
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onEdit(ver)}>
                                Editar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                disabled={pdfState[ver.id] === 'loading'}
                                onClick={() => handleDownloadPDF(ver)}
                              >
                                {pdfState[ver.id] === 'loading' ? '...' :
                                 pdfState[ver.id] === 'done'    ? '✓' :
                                 pdfState[ver.id] === 'error'   ? '✗' : 'PDF'}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
