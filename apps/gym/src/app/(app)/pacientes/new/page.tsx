import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { NewClientForm } from '@/components/fisio/NewClientForm';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';

export default function NewPatientPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Volver al dashboard
      </Link>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo paciente</CardTitle>
          <CardDescription>
            Completa los datos del paciente para generar planes adaptados con IA.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <NewClientForm />
        </CardContent>
      </Card>
    </div>
  );
}
