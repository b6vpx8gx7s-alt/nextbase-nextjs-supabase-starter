import { NextRequest } from 'next/server'
import { withRodaAIContext } from '../context'
import { createGymAdminClient } from '@/app/api/gym/_helpers'
import { getRodaAIBusinessContext } from '@/lib/rodaai-business'
import { detectRoutineConflictsTool } from '@/lib/rodaai-tools-gym'

export async function GET(request: NextRequest) {
  return withRodaAIContext(request, async (context) => {
    const supabase = createGymAdminClient()
    const { data, error } = await supabase
      .from('rodaai_limitation_suggestions')
      .select('id, client_id, session_id, suggested_text, suggested_type, source_quote, status, created_at, gym_clients(nombre)')
      .eq('business_id', context.businessId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    if (error) throw error
    return { suggestions: data || [] }
  })
}

export async function POST(request: NextRequest) {
  return withRodaAIContext(request, async (context, body) => {
    const { suggestionId, action } = body as { suggestionId: string; action: 'accept' | 'reject' }

    if (!suggestionId || !['accept', 'reject'].includes(action)) {
      throw new Error('Missing suggestionId or invalid action')
    }

    const supabase = createGymAdminClient()

    const { data: suggestion, error: fetchError } = await supabase
      .from('rodaai_limitation_suggestions')
      .select('*')
      .eq('id', suggestionId)
      .eq('business_id', context.businessId)
      .single()

    if (fetchError || !suggestion) throw new Error('Sugerencia no encontrada')

    let conflictCheck: { hasConflicts: boolean; clientName?: string; summary?: string } | null = null

    if (action === 'accept') {
      const { data: client } = await supabase
        .from('gym_clients')
        .select('lesion_actual, nombre')
        .eq('id', suggestion.client_id)
        .single()

      const newLimitation = client?.lesion_actual
        ? `${client.lesion_actual}. ${suggestion.suggested_text}`
        : suggestion.suggested_text

      const { error: updateError } = await supabase
        .from('gym_clients')
        .update({ lesion_actual: newLimitation })
        .eq('id', suggestion.client_id)

      if (updateError) throw updateError

      try {
        const businessContext = await getRodaAIBusinessContext(context.userId)
        const result = await detectRoutineConflictsTool.execute(businessContext, {
          clientName: client?.nombre,
        })
        if (result.totalConflicts > 0) {
          conflictCheck = {
            hasConflicts: true,
            clientName: client?.nombre,
            summary: result.summary,
          }
        }
      } catch (conflictError) {
        console.error('[RodaAI] Error checking conflicts after accept:', conflictError)
      }
    }

    const { error: statusError } = await supabase
      .from('rodaai_limitation_suggestions')
      .update({ status: action === 'accept' ? 'accepted' : 'rejected', resolved_at: new Date().toISOString() })
      .eq('id', suggestionId)

    if (statusError) throw statusError

    return { success: true, conflictCheck }
  })
}
