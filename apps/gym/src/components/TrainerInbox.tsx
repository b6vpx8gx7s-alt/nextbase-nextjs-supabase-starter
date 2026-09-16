'use client';

import { useEffect, useState } from 'react';
import { AlertCenter } from '@/components/AlertCenter';
import { LimitationSuggestions } from '@/components/LimitationSuggestions';

type Tab = 'alerts' | 'limitations';

interface TrainerInboxProps {
  userRole: 'trainer' | 'client';
}

export function TrainerInbox({ userRole }: TrainerInboxProps) {
  const [alertCount, setAlertCount] = useState(0);
  const [limitationCount, setLimitationCount] = useState(0);
  const [ready, setReady] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('alerts');

  useEffect(() => {
    Promise.all([
      fetch('/api/gym/rodaai/alerts')
        .then((r) => r.json())
        .then((d) => d.totalAlerts ?? 0)
        .catch(() => 0),
      fetch('/api/gym/rodaai/limitation-suggestions')
        .then((r) => r.json())
        .then((d) => (d.suggestions ?? []).length)
        .catch(() => 0),
    ]).then(([alerts, limitations]) => {
      setAlertCount(alerts as number);
      setLimitationCount(limitations as number);
      // Si no hay alertas pero sí sugerencias, abrir en el tab correcto
      if ((alerts as number) === 0 && (limitations as number) > 0) {
        setActiveTab('limitations');
      }
      setReady(true);
    });
  }, []);

  if (userRole !== 'trainer') return null;
  if (!ready) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-4 mb-6 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-48" />
      </div>
    );
  }
  if (alertCount === 0 && limitationCount === 0) return null;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'alerts', label: 'Alertas', count: alertCount },
    { key: 'limitations', label: 'Limitaciones IA', count: limitationCount },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white mb-6 overflow-hidden">
      <div className="flex border-b border-gray-100 bg-gray-50">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px
                ${isActive
                  ? 'border-[#1B8BA8] text-[#1B8BA8] bg-white'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`text-xs font-semibold rounded-full px-1.5 py-0.5 leading-none
                    ${isActive ? 'bg-[#1B8BA8] text-white' : 'bg-gray-200 text-gray-600'}`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div>
        {activeTab === 'alerts' && <AlertCenter userRole={userRole} />}
        {activeTab === 'limitations' && <LimitationSuggestions userRole={userRole} />}
      </div>
    </div>
  );
}
