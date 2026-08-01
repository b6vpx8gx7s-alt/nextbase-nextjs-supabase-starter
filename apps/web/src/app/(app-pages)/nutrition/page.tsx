'use client'

import { useState, useEffect } from 'react'
import { PlanEditor } from '@/components/nutrition/PlanEditor'
import { PlanHistory } from '@/components/nutrition/PlanHistory'
import { PlanDetail } from '@/components/nutrition/PlanDetail'
import { NutritionPlan } from '@/lib/nutrition-types'

type View = 'list' | 'new' | 'edit' | 'detail'

export default function NutritionPage() {
  const [view, setView] = useState<View>('list')
  const [selectedPlan, setSelectedPlan] = useState<NutritionPlan | null>(null)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [businessName, setBusinessName] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/nutrition/user-context')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.businessName) setBusinessName(d.businessName) })
      .catch(() => {})
  }, [])

  function refresh() {
    setRefreshTrigger(t => t + 1)
    setView('list')
    setSelectedPlan(null)
  }

  if (view === 'new') {
    return (
      <div className="p-4 md:p-6">
        <div className="mb-4">
          <button
            onClick={() => setView('list')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-semibold mt-1">Nuevo plan nutricional</h1>
        </div>
        <PlanEditor
          onSave={() => refresh()}
          onCancel={() => setView('list')}
        />
      </div>
    )
  }

  if (view === 'edit' && selectedPlan) {
    return (
      <div className="p-4 md:p-6">
        <div className="mb-4">
          <button
            onClick={() => setView('list')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Volver
          </button>
          <h1 className="text-xl font-semibold mt-1">Editar plan — {selectedPlan.client_name}</h1>
        </div>
        <PlanEditor
          initialPlan={selectedPlan}
          onSave={() => refresh()}
          onCancel={() => setView('list')}
        />
      </div>
    )
  }

  if (view === 'detail' && selectedPlan) {
    return (
      <div className="p-4 md:p-6">
        <PlanDetail
          plan={selectedPlan}
          businessName={businessName}
          onBack={() => setView('list')}
          onEdit={plan => { setSelectedPlan(plan); setView('edit') }}
        />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6">
      <PlanHistory
        refreshTrigger={refreshTrigger}
        businessName={businessName}
        onNew={() => setView('new')}
        onView={plan => { setSelectedPlan(plan); setView('detail') }}
        onEdit={plan => { setSelectedPlan(plan); setView('edit') }}
      />
    </div>
  )
}
