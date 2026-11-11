'use client';

import { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReferencePhoto {
  id: string;
  gender: 'masculino' | 'femenino';
  photo_url: string;
  caption: string | null;
  display_order: number;
}

type Gender = 'masculino' | 'femenino';

const GENDERS: { key: Gender; label: string; icon: string }[] = [
  { key: 'masculino', label: 'Hombres', icon: '👨' },
  { key: 'femenino',  label: 'Mujeres',  icon: '👩' },
];

export default function ConfiguracionPage() {
  const [photos, setPhotos] = useState<ReferencePhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<Gender | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingGenderRef = useRef<Gender | null>(null);

  useEffect(() => {
    fetch('/api/gym/reference-photos')
      .then(r => r.json())
      .then(d => setPhotos(d.photos ?? []))
      .catch(() => toast.error('Error al cargar fotos'))
      .finally(() => setLoading(false));
  }, []);

  function triggerUpload(gender: Gender) {
    pendingGenderRef.current = gender;
    setCaptionDraft('');
    fileInputRef.current?.click();
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const gender = pendingGenderRef.current;
    if (!file || !gender) return;
    e.target.value = '';

    setUploading(gender);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('gender', gender);
      if (captionDraft.trim()) fd.append('caption', captionDraft.trim());

      const res = await fetch('/api/gym/reference-photos', { method: 'POST', body: fd });
      if (!res.ok) { const { error } = await res.json(); throw new Error(error); }
      const { photo } = await res.json();
      setPhotos(prev => [...prev, photo]);
      toast.success('Foto agregada');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al subir');
    } finally {
      setUploading(null);
      pendingGenderRef.current = null;
    }
  }

  async function handleDelete(id: string, storagePath: string) {
    if (!confirm('¿Eliminar esta foto de referencia?')) return;
    try {
      const res = await fetch(`/api/gym/reference-photos/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar');
      setPhotos(prev => prev.filter(p => p.id !== id));
      toast.success('Foto eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm mt-1">Personaliza la experiencia de tus clientes</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ImagePlus className="h-5 w-5" />
            Fotos de referencia para medidas
          </CardTitle>
          <CardDescription>
            Sube fotos que muestren <strong>cómo deben tomarse las fotos corporales</strong> tus clientes.
            Se muestran en su app según su género. Máx. 10 MB por foto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            GENDERS.map(({ key, label, icon }) => {
              const genderPhotos = photos.filter(p => p.gender === key);
              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <span>{icon}</span> {label}
                      <span className="text-xs font-normal text-muted-foreground">({genderPhotos.length} foto{genderPhotos.length !== 1 ? 's' : ''})</span>
                    </p>
                    <Button
                      size="sm" variant="outline"
                      onClick={() => triggerUpload(key)}
                      disabled={uploading === key}
                    >
                      {uploading === key ? (
                        <><span className="animate-spin mr-1">⏳</span>Subiendo…</>
                      ) : (
                        <><Upload className="h-3.5 w-3.5 mr-1" />Agregar foto</>
                      )}
                    </Button>
                  </div>

                  {genderPhotos.length === 0 ? (
                    <div
                      className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => triggerUpload(key)}
                    >
                      <ImagePlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                      <p className="text-sm text-muted-foreground">Sin fotos de referencia para {label.toLowerCase()}</p>
                      <p className="text-xs text-muted-foreground mt-1">Haz clic para subir la primera</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {genderPhotos.map(photo => (
                        <div key={photo.id} className="relative group rounded-lg overflow-hidden border bg-muted aspect-[3/4]">
                          <img
                            src={photo.photo_url}
                            alt={photo.caption ?? 'Referencia'}
                            className="w-full h-full object-cover"
                          />
                          {photo.caption && (
                            <div className="absolute bottom-0 inset-x-0 bg-black/60 px-2 py-1">
                              <p className="text-white text-xs truncate">{photo.caption}</p>
                            </div>
                          )}
                          <button
                            onClick={() => handleDelete(photo.id, '')}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 hover:bg-red-600 text-white rounded-full p-1"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => triggerUpload(key)}
                        className="border-2 border-dashed rounded-lg aspect-[3/4] flex flex-col items-center justify-center gap-2 text-muted-foreground hover:bg-muted/30 transition-colors"
                      >
                        <ImagePlus className="h-6 w-6" />
                        <span className="text-xs">Agregar</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
