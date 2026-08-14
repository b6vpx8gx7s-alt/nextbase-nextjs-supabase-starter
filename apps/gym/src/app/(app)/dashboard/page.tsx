import { ClientList } from '@/components/fisio/ClientList';

export default function DashboardPage() {
  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Gestiona los planes de entrenamiento de tus clientes.
        </p>
      </div>
      <ClientList />
    </div>
  );
}
