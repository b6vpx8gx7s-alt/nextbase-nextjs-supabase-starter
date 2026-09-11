'use client';

import { useEffect, useState } from 'react';

interface AlertClient {
  id: string;
  nombre: string;
}

interface AlertGroup {
  count: number;
  clients: AlertClient[];
  description: string;
}

interface AlertsData {
  success: boolean;
  totalAlerts: number;
  alerts: {
    noRoutine: AlertGroup;
    inactive: AlertGroup;
    noActivity: AlertGroup;
  };
}

interface AlertCenterProps {
  userRole: 'trainer' | 'client';
}

export function AlertCenter({ userRole }: AlertCenterProps) {
  const [data, setData] = useState<AlertsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/gym/rodaai/alerts')
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (userRole === 'client') return null;

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-40" />
      </div>
    );
  }

  if (!data?.success) return null;

  if (data.totalAlerts === 0) {
    return (
      <div className="rounded-xl border border-[#1B8BA8]/30 bg-[#1B8BA8]/5 p-4 mb-6 flex items-center gap-3">
        <span className="text-lg">✅</span>
        <p className="text-sm font-medium text-[#0E5A6E]">Todos tus clientes están al día</p>
      </div>
    );
  }

  const sections = [
    {
      key: 'noRoutine' as const,
      emoji: '⚠️',
      label: 'Sin rutina vigente',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      dot: 'bg-amber-500',
    },
    {
      key: 'inactive' as const,
      emoji: '📊',
      label: 'Inactivos 2+ semanas',
      color: 'text-orange-700',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      dot: 'bg-orange-500',
    },
    {
      key: 'noActivity' as const,
      emoji: '🚫',
      label: 'Sin actividad registrada',
      color: 'text-red-700',
      bg: 'bg-red-50',
      border: 'border-red-200',
      dot: 'bg-red-400',
    },
  ].filter((s) => data.alerts[s.key].count > 0);

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-6 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50">
        <span className="text-sm font-semibold text-gray-700">Alertas de clientes</span>
        <span className="text-xs font-medium bg-[#1B8BA8] text-white rounded-full px-2 py-0.5">
          {data.totalAlerts}
        </span>
      </div>
      <div className="divide-y divide-gray-100">
        {sections.map((s) => {
          const group = data.alerts[s.key];
          return (
            <details key={s.key} className="group">
              <summary
                className={`flex items-center justify-between px-4 py-3 cursor-pointer select-none list-none hover:bg-gray-50 transition-colors`}
              >
                <span className={`text-sm font-medium flex items-center gap-2 ${s.color}`}>
                  <span>{s.emoji}</span>
                  {s.label}
                </span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.bg} ${s.color}`}>
                  {group.count}
                </span>
              </summary>
              <ul className={`px-4 pb-3 pt-1 ${s.bg} space-y-1`}>
                {group.clients.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${s.dot}`} />
                    {c.nombre}
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
      </div>
    </div>
  );
}
