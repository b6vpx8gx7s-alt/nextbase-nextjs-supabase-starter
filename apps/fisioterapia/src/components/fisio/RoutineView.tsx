import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Dumbbell } from 'lucide-react';
import type { PhysioRoutine, DraftDia } from '@/lib/fisio-types';

const equipoLabel: Record<string, string> = {
  ninguno: 'Sin equipo',
  banda: 'Banda elástica',
  mancuernas: 'Mancuernas',
  barra: 'Barra',
  maquina: 'Máquina',
};

function DayCard({ dia }: { dia: DraftDia }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{dia.nombre}</CardTitle>
        <p className="text-xs text-muted-foreground">{dia.ejercicios.length} ejercicios</p>
      </CardHeader>
      <CardContent className="space-y-3">
        {dia.ejercicios.map((ej, i) => (
          <div key={i} className="rounded-md border p-3 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-10 w-10 shrink-0 rounded overflow-hidden bg-muted flex items-center justify-center">
                  {ej.gif_url ? (
                    <img src={ej.gif_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <Dumbbell className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <span className="text-sm font-medium">{ej.nombre}</span>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {ej.series}×{ej.repeticiones}
              </Badge>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-6">
              <span>Descanso: {ej.descanso_seg}s</span>
            </div>
            {ej.nota && (
              <div className="flex items-start gap-1.5 rounded-md bg-yellow-50 dark:bg-yellow-950/30 px-2.5 py-1.5 pl-6 text-xs text-yellow-800 dark:text-yellow-200">
                <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{ej.nota}</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function RoutineView({ routine }: { routine: PhysioRoutine }) {
  if (!routine.routine_data?.dias) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Esta rutina no tiene datos de ejercicios. Genera un nuevo plan.
        </p>
      </div>
    );
  }

  const { dias, notas_generales } = routine.routine_data;

  return (
    <div className="space-y-4">
      {notas_generales && (
        <div className="rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Notas del plan</p>
          {notas_generales}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dias.map((dia) => (
          <DayCard key={dia.dia_index} dia={dia} />
        ))}
      </div>
    </div>
  );
}

export { equipoLabel };
