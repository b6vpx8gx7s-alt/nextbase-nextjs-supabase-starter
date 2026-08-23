'use client';

import { useState } from 'react';
import { ExerciseApprovalList } from './ExerciseApprovalList';
import { ExerciseCatalogList } from './ExerciseCatalogList';
import { ExerciseUnpublishedList } from './ExerciseUnpublishedList';

type PendingExercise = {
  id: string;
  nombre: string;
  grupo_muscular: string;
  gif_url: string | null;
  business_name: string | null;
};

type Tab = 'pending' | 'catalog' | 'unpublished';

export function AdminExerciseTabs({ initialPending }: { initialPending: PendingExercise[] }) {
  const [activeTab, setActiveTab] = useState<Tab>('pending');

  const tabClass = (tab: Tab) =>
    `px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
      activeTab === tab
        ? 'border-primary text-primary'
        : 'border-transparent text-muted-foreground hover:text-foreground'
    }`;

  return (
    <div>
      <div className="flex border-b mb-6">
        <button onClick={() => setActiveTab('pending')} className={tabClass('pending')}>
          Pendientes
          {initialPending.length > 0 && (
            <span className="ml-2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {initialPending.length}
            </span>
          )}
        </button>
        <button onClick={() => setActiveTab('catalog')} className={tabClass('catalog')}>
          Catálogo global
        </button>
        <button onClick={() => setActiveTab('unpublished')} className={tabClass('unpublished')}>
          Despublicados
        </button>
      </div>

      {activeTab === 'pending' && <ExerciseApprovalList initialExercises={initialPending} />}
      {activeTab === 'catalog' && <ExerciseCatalogList />}
      {activeTab === 'unpublished' && <ExerciseUnpublishedList />}
    </div>
  );
}
