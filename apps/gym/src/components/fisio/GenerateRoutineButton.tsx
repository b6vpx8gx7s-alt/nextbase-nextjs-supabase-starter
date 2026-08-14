'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import type { PhysioRoutine } from '@/lib/fisio-types';
import toast from 'react-hot-toast';

interface Props {
  clientId: string;
  onGenerated: (routine: PhysioRoutine) => void;
}

export function GenerateRoutineButton({ clientId, onGenerated }: Props) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const toastId = toast.loading('Generando plan con IA…');
    try {
      const res = await fetch('/api/gym/routines/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId }),
      });

      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Error al generar');
      }

      const { routine } = await res.json();
      toast.success('Plan generado', { id: toastId });
      onGenerated(routine);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error inesperado', { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleGenerate} disabled={loading}>
      <Sparkles className="h-4 w-4" />
      {loading ? 'Generando…' : 'Generar plan con IA'}
    </Button>
  );
}
