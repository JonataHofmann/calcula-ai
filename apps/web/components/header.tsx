'use client';

import { Avatar, IconButton, SearchField, Skeleton } from '@finance/ui';
import { Bell, Menu, PanelLeft, Settings } from 'lucide-react';
import { useSession } from '../features/auth/use-session';
import { useAppDispatch } from '../hooks/use-store';
import { toggleSidebar, toggleSidebarMobile } from '../store/ui-slice';
import { PeriodSelector } from './period-selector';
import { ThemeToggle } from './theme-toggle';

export function Header() {
  const { user, isLoading } = useSession();
  const dispatch = useAppDispatch();

  return (
    <header className="bg-background/80 border-border sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 backdrop-blur md:px-6">
      <IconButton
        aria-label="Abrir menu"
        onClick={() => dispatch(toggleSidebarMobile())}
        className="md:hidden"
      >
        <Menu />
      </IconButton>
      <IconButton
        aria-label="Recolher menu"
        onClick={() => dispatch(toggleSidebar())}
        className="hidden md:inline-flex"
      >
        <PanelLeft />
      </IconButton>

      <SearchField
        placeholder="Buscar algo"
        aria-label="Buscar"
        className="hidden max-w-[480px] flex-1 sm:block"
      />

      <div className="flex flex-1 items-center justify-end gap-1.5 sm:gap-2">
        <div className="hidden lg:block">
          <PeriodSelector />
        </div>

        <ThemeToggle />
        <IconButton aria-label="Configurações" className="hidden sm:inline-flex">
          <Settings />
        </IconButton>
        <IconButton aria-label="Notificações" dot className="hidden sm:inline-flex">
          <Bell />
        </IconButton>

        <span className="bg-border mx-1 hidden h-7 w-px sm:block" aria-hidden="true" />

        {isLoading ? (
          <div className="flex items-center gap-2.5">
            <div className="hidden flex-col items-end gap-1 sm:flex">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-9 w-9 rounded-full" />
          </div>
        ) : user ? (
          <div className="flex items-center gap-2.5 pl-1">
            <Avatar name={user.name} alt={user.name} size="lg" />
            <span className="hidden flex-col items-start leading-tight sm:flex">
              <span className="text-text text-sm font-semibold">{user.name}</span>
              {user.email ? <span className="text-text-muted text-xs">{user.email}</span> : null}
            </span>
          </div>
        ) : null}
      </div>
    </header>
  );
}
