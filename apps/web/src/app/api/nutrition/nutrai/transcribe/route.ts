import { NextRequest } from 'next/server';
import { extractNutriAIContext } from '../context';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  try {
    await extractNutriAIContext(request);

    const formData = await request.formData();
    const audioFile = formData.get('audio') as File | null;

    if (!audioFile) {
      return Response.json({ error: 'No se recibió archivo de audio' }, { status: 400 });
    }

    const transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'gpt-4o-transcribe',
      language: 'es',
    });

    return Response.json({ text: transcription.text });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[NutriAI] Error transcribing audio:', message);
    return Response.json({ error: 'Error al transcribir el audio' }, { status: 500 });
  }
}
