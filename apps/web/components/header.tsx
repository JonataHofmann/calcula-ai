'use client';

import { Skeleton } from '@finance/ui';
import { LogOut, Menu } from 'lucide-react';
import { useSession } from '../features/auth/use-session';
import { useAppDispatch } from '../hooks/use-store';
import { logout } from '../services/auth-api';
import { toggleSidebarMobile } from '../store/ui-slice';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  const { user, isLoading } = useSession();
  const dispatch = useAppDispatch();

  async function handleLogout() {
    const logoutUrl = await logout();
    window.location.assign(logoutUrl ?? '/');
  }

  return (
    <header className="bg-surface border-border sticky top-0 z-30 flex h-14 items-center justify-between border-b px-4">
      <button
        type="button"
        onClick={() => dispatch(toggleSidebarMobile())}
        aria-label="Abrir menu"
        className="text-text-muted hover:text-text focus-visible:ring-focus-ring rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex flex-1 items-center justify-end gap-4">
        <ThemeToggle />
        {isLoading ? (
          <div className="flex flex-col items-end gap-1">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-3 w-36" />
          </div>
        ) : user ? (
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium">{user.name}</span>
            {user.email ? <span className="text-text-muted text-xs">{user.email}</span> : null}
          </div>
        ) : null}
        <button
          type="button"
          onClick={handleLogout}
          className="text-text-muted hover:text-danger focus-visible:ring-focus-ring flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sair
        </button>
      </div>
    </header>
  );
}
