import { NextRequest } from 'next/server'
import { extractRodaAIContext } from '../context'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export async function POST(request: NextRequest) {
  // FormData no es compatible con withRodaAIContext (espera JSON).
  // Usamos extractRodaAIContext directamente para validar auth.
  try {
    await extractRodaAIContext(request)

    const formData = await request.formData()
    const audioFile = formData.get('audio') as File | null

    if (!audioFile) {
      return Response.json({ error: 'No se recibió archivo de audio' }, { status: 400 })
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'gpt-4o-transcribe',
      language: 'es',
    })

    return Response.json({ text: transcription.text })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido'
    console.error('[RodaAI] Error transcribing audio:', message)
    return Response.json({ error: 'Error al transcribir el audio' }, { status: 500 })
  }
}
