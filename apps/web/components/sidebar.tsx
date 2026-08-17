'use client';

import { cn } from '@finance/ui';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { NAV_ITEMS } from '../features/navigation/nav-items';
import { useAppDispatch, useAppSelector } from '../hooks/use-store';
import { closeSidebarMobile, toggleSidebar } from '../store/ui-slice';

export function Sidebar() {
  const pathname = usePathname();
  const sidebarOpen = useAppSelector((state) => state.ui.sidebarOpen);
  const sidebarMobileOpen = useAppSelector((state) => state.ui.sidebarMobileOpen);
  const dispatch = useAppDispatch();

  const previousPathname = useRef(pathname);
  useEffect(() => {
    if (previousPathname.current !== pathname) {
      previousPathname.current = pathname;
      dispatch(closeSidebarMobile());
    }
  }, [pathname, dispatch]);

  useEffect(() => {
    if (!sidebarMobileOpen) {
      return;
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        dispatch(closeSidebarMobile());
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [sidebarMobileOpen, dispatch]);

  const navContent = (
    <nav aria-label="Menu principal" className="flex flex-1 flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-text-muted hover:bg-border/40 hover:text-text',
              !sidebarOpen && 'md:justify-center md:px-2',
            )}
            title={!sidebarOpen ? item.label : undefined}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            <span className={cn(!sidebarOpen && 'md:hidden')}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {sidebarMobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          aria-hidden="true"
          onClick={() => dispatch(closeSidebarMobile())}
        />
      ) : null}

      <aside
        className={cn(
          'bg-surface border-border fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform md:hidden',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-border flex h-14 items-center border-b px-4 text-sm font-semibold">
          Finance
        </div>
        {navContent}
      </aside>

      <aside
        className={cn(
          'bg-surface border-border sticky top-0 hidden h-screen flex-col border-r transition-all md:flex',
          sidebarOpen ? 'w-64' : 'w-16',
        )}
      >
        <div className="border-border flex h-14 items-center justify-between border-b px-4">
          <span className={cn('text-sm font-semibold', !sidebarOpen && 'md:hidden')}>Finance</span>
          <button
            type="button"
            onClick={() => dispatch(toggleSidebar())}
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
            className="text-text-muted hover:text-text focus-visible:ring-focus-ring rounded-md p-1 transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            {sidebarOpen ? (
              <PanelLeftClose className="h-5 w-5" aria-hidden="true" />
            ) : (
              <PanelLeftOpen className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
        {navContent}
      </aside>
    </>
  );
}
