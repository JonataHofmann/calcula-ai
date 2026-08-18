'use client';

import { Avatar, SearchField, Skeleton } from '@finance/ui';
import { Bell, LogOut, Menu, Settings } from 'lucide-react';
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
    <header className="bg-surface border-border sticky top-0 z-30 flex h-16 items-center gap-4 border-b px-4 md:px-6">
      <button
        type="button"
        onClick={() => dispatch(toggleSidebarMobile())}
        aria-label="Abrir menu"
        className="text-text-muted hover:text-text focus-visible:ring-focus-ring rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <SearchField
        placeholder="Buscar algo"
        aria-label="Buscar"
        className="hidden max-w-xs flex-1 sm:block [&_input]:rounded-full [&_input]:bg-background"
      />

      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-3">
        <ThemeToggle />
        <button
          type="button"
          aria-label="Configurações"
          className="text-text-muted hover:text-text bg-background focus-visible:ring-focus-ring hidden h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none sm:flex"
        >
          <Settings className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Notificações"
          className="text-info hover:text-info bg-info-soft focus-visible:ring-focus-ring relative hidden h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none sm:flex"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          <span
            className="bg-danger absolute top-2.5 right-2.5 h-2 w-2 rounded-full"
            aria-hidden="true"
          />
        </button>

        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="hidden flex-col items-end gap-1 sm:flex">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        ) : user ? (
          <div className="flex items-center gap-2">
            <div className="hidden flex-col items-end sm:flex">
              <span className="text-sm font-medium">{user.name}</span>
              {user.email ? <span className="text-text-muted text-xs">{user.email}</span> : null}
            </div>
            <Avatar name={user.name} alt={user.name} size="md" />
          </div>
        ) : null}

        <button
          type="button"
          onClick={handleLogout}
          className="text-text-muted hover:text-danger focus-visible:ring-focus-ring flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Sair</span>
        </button>
      </div>
    </header>
  );
}
