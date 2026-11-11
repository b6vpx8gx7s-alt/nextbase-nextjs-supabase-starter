'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera } from 'lucide-react';

interface ClientPhoto {
  id: string;
  photo_url: string | null;
  photo_date: string;
  notes: string | null;
}

export function ClientProgressPhotos({ clientId }: { clientId: string }) {
  const [photos, setPhotos] = useState<ClientPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClientPhoto | null>(null);

  useEffect(() => {
    fetch(`/api/gym/client-photos?client_id=${clientId}`)
      .then(r => r.ok ? r.json() : { photos: [] })
      .then(d => setPhotos(d.photos ?? []))
      .finally(() => setLoading(false));
  }, [clientId]);

  if (loading) return null;
  if (photos.length === 0) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            Fotos de progreso
            <span className="text-xs font-normal text-muted-foreground ml-1">({photos.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {photos.map(photo => (
              <button
                key={photo.id}
                onClick={() => setSelected(photo)}
                className="relative rounded-lg overflow-hidden border aspect-[3/4] bg-muted hover:opacity-90 transition-opacity"
              >
                {photo.photo_url ? (
                  <img
                    src={photo.photo_url}
                    alt={photo.notes ?? 'Foto de progreso'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <Camera className="h-6 w-6" />
                  </div>
                )}
                <div className="absolute bottom-0 inset-x-0 bg-black/50 px-1.5 py-1">
                  <p className="text-white text-[10px]">
                    {new Date(photo.photo_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Lightbox */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setSelected(null)}
        >
          <div className="relative max-w-sm w-full" onClick={e => e.stopPropagation()}>
            {selected.photo_url && (
              <img
                src={selected.photo_url}
                alt={selected.notes ?? 'Foto de progreso'}
                className="w-full rounded-xl object-contain max-h-[80vh]"
              />
            )}
            <div className="mt-2 text-center">
              <p className="text-white text-sm">
                {new Date(selected.photo_date).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
              {selected.notes && <p className="text-white/70 text-xs mt-0.5">{selected.notes}</p>}
            </div>
            <button
              onClick={() => setSelected(null)}
              className="absolute -top-3 -right-3 bg-white text-black rounded-full w-7 h-7 flex items-center justify-center text-sm font-bold hover:bg-gray-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </>
  );
}
