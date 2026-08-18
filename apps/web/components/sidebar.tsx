'use client';

import { cn } from '@finance/ui';
import { CircleDollarSign, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { NAV_ITEMS } from '../features/navigation/nav-items';
import { useAppDispatch, useAppSelector } from '../hooks/use-store';
import { closeSidebarMobile, toggleSidebar } from '../store/ui-slice';

/** Brand mark: a primary-tinted glyph tile plus the wordmark (hidden when collapsed). */
function Brand({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <span className="flex items-center gap-2.5 overflow-hidden">
      <span className="bg-primary text-primary-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-xl shadow-sm">
        <CircleDollarSign className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className={cn('text-text text-base font-semibold tracking-tight', collapsed && 'md:hidden')}>
        Finance
      </span>
    </span>
  );
}

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
      <span
        className={cn(
          'text-text-muted px-3 pt-2 pb-1 text-[0.7rem] font-semibold tracking-wider uppercase',
          !sidebarOpen && 'md:hidden',
        )}
      >
        Menu
      </span>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'group focus-visible:ring-focus-ring relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none',
              active
                ? 'bg-primary/10 text-primary'
                : 'text-text-muted hover:bg-border/40 hover:text-text',
              !sidebarOpen && 'md:justify-center md:px-2',
            )}
            title={!sidebarOpen ? item.label : undefined}
          >
            {active ? (
              <span
                className="bg-primary absolute top-1/2 left-0 h-6 w-1 -translate-y-1/2 rounded-r-full"
                aria-hidden="true"
              />
            ) : null}
            <Icon
              className={cn(
                'h-5 w-5 shrink-0 transition-colors',
                !active && 'group-hover:text-text',
              )}
              aria-hidden="true"
            />
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
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[1px] md:hidden"
          aria-hidden="true"
          onClick={() => dispatch(closeSidebarMobile())}
        />
      ) : null}

      <aside
        className={cn(
          'bg-surface border-border fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r shadow-lg transition-transform md:hidden',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="border-border flex h-16 items-center border-b px-4">
          <Brand />
        </div>
        {navContent}
      </aside>

      <aside
        className={cn(
          'bg-surface border-border sticky top-0 hidden h-screen flex-col border-r transition-all md:flex',
          sidebarOpen ? 'w-64' : 'w-16',
        )}
      >
        <div
          className={cn(
            'border-border flex h-16 items-center border-b',
            sidebarOpen ? 'justify-between px-4' : 'justify-center px-2',
          )}
        >
          {sidebarOpen ? <Brand collapsed /> : null}
          <button
            type="button"
            onClick={() => dispatch(toggleSidebar())}
            aria-expanded={sidebarOpen}
            aria-label={sidebarOpen ? 'Recolher menu' : 'Expandir menu'}
            className="text-text-muted hover:bg-border/40 hover:text-text focus-visible:ring-focus-ring rounded-md p-1.5 transition-colors focus-visible:ring-2 focus-visible:outline-none"
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
