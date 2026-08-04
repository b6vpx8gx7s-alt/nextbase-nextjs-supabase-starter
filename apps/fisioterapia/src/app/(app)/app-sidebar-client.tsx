'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, LogOut, ChevronUp } from 'lucide-react';
import { createClient } from '@/supabase-clients/client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { User } from '@supabase/supabase-js';

const navItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Pacientes', url: '/pacientes', icon: Users },
];

export function AppSidebarContent({ user }: { user: User }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const supabase = createClient();

  const userEmail = user.email ?? '';
  const userName = user.user_metadata?.name ?? userEmail.split('@')[0] ?? 'Usuario';
  const initials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  async function handleSignOut() {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push(process.env.NODE_ENV === 'production' ? 'https://roda.ink/login' : '/login');
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 items-center px-4 border-b">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg shrink-0"
            style={{ background: '#3DD9B0' }}
          >
            <span style={{ fontFamily: 'Sora, sans-serif', fontWeight: 800, fontSize: '0.6rem', color: '#0F2730', letterSpacing: '-0.02em' }}>
              RODA
            </span>
          </div>
          <div className="grid leading-tight">
            <span className="font-bold text-sm" style={{ fontFamily: 'Sora, sans-serif', letterSpacing: '-0.02em' }}>
              RODA<span style={{ color: '#3DD9B0' }}>.</span>ink
            </span>
            <span className="text-[11px] text-muted-foreground">Fisioterapia</span>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        <p className="px-3 py-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider">Menú</p>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.url);
          const Icon = item.icon;
          return (
            <Link
              key={item.url}
              href={item.url}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                ${isActive
                  ? 'bg-sidebar-primary/10 text-sidebar-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Footer: user */}
      <div className="border-t px-3 py-3">
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-accent text-sm font-semibold">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          </div>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="text-muted-foreground hover:text-foreground transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
