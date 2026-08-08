'use client';
import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { ExerciseThumb } from '@/components/fisio/ExerciseThumb';

export function ExerciseLightbox({
  gif_url,
  nombre,
  className,
}: {
  gif_url?: string | null;
  nombre?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => { if (gif_url) setOpen(true); }}
        className={gif_url ? 'cursor-zoom-in' : 'cursor-default'}
        tabIndex={gif_url ? 0 : -1}
        aria-label={gif_url ? `Ver imagen de ${nombre ?? 'ejercicio'}` : undefined}
      >
        <ExerciseThumb gif_url={gif_url} className={className} />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            onClick={() => setOpen(false)}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={gif_url!}
            alt={nombre ?? 'Ejercicio'}
            className="max-h-[80vh] max-w-[90vw] rounded-lg object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {nombre && (
            <p className="absolute bottom-6 left-0 right-0 text-center text-sm font-semibold text-white drop-shadow">
              {nombre}
            </p>
          )}
        </div>
      )}
    </>
  );
}
