'use client';

import { cn } from '@finance/ui';
import { LogOut } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { NAV_ITEMS } from '../features/navigation/nav-items';
import { useAppDispatch, useAppSelector } from '../hooks/use-store';
import { logout } from '../services/auth-api';
import { closeSidebarMobile } from '../store/ui-slice';

/** Brand logo tile (indigo, white bold "C") — matches the Keycloak login mark and app/icon.svg. */
function BrandGlyph({ className }: { className?: string }) {
  return (
    <span className={cn('shrink-0 overflow-hidden rounded-icon', className)}>
      <svg viewBox="0 0 32 32" className="h-10 w-10" aria-hidden="true">
        <rect width="32" height="32" fill="#3730c9" />
        <text
          x="16"
          y="22"
          fontSize="18"
          fontFamily="Inter, Arial, sans-serif"
          fontWeight="800"
          fill="#ffffff"
          textAnchor="middle"
        >
          C
        </text>
      </svg>
    </span>
  );
}

async function handleLogout() {
  const logoutUrl = await logout();
  window.location.assign(logoutUrl ?? '/');
}

/**
 * App shell navigation: a 72px indigo icon rail (primary destinations, always
 * visible on desktop) with tooltips. No white sidebar column. On mobile
 * collapses into a single labelled drawer driven by `sidebarMobileOpen`.
 */
export function Sidebar() {
  const pathname = usePathname();
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

  // Icon rail (desktop only) — brand, primary nav icons, logout.
  const rail = (
    <aside className="bg-nav-bg sticky top-0 hidden h-screen w-18 shrink-0 flex-col items-center py-4 md:flex">
      <Link
        href="/"
        aria-label="Início"
        className="focus-visible:ring-nav-item-on relative rounded-icon focus-visible:ring-2 focus-visible:outline-none group"
      >
        <BrandGlyph />
        <span
          role="tooltip"
          className="bg-text text-text-foreground pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 rounded-md px-2 py-1 text-xs whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          Calcula aí
        </span>
      </Link>
      <nav aria-label="Menu principal" className="mt-6 flex flex-1 flex-col items-center gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-nav-item-on relative flex h-11 w-11 items-center justify-center rounded-icon transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none group',
                active
                  ? 'text-nav-item-on'
                  : 'text-nav-item hover:bg-nav-bg-deep hover:text-nav-item-on',
              )}
            >
              {active ? (
                <span
                  className="bg-nav-item-on absolute top-1/2 -left-4 h-6 w-0.75 -translate-y-1/2 rounded-r-full"
                  aria-hidden="true"
                />
              ) : null}
              <Icon className="h-5.5 w-5.5" aria-hidden="true" />
              <span
                role="tooltip"
                className="bg-text text-text-foreground pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 rounded-md px-2 py-1 text-xs whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={handleLogout}
        aria-label="Sair"
        className="text-nav-item hover:bg-nav-bg-deep hover:text-nav-item-on focus-visible:ring-nav-item-on relative flex h-11 w-11 items-center justify-center rounded-icon transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none group"
      >
        <LogOut className="h-5 w-5" aria-hidden="true" />
        <span
          role="tooltip"
          className="bg-text text-text-foreground pointer-events-none absolute top-1/2 left-full z-50 ml-3 -translate-y-1/2 rounded-md px-2 py-1 text-xs whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
        >
          Sair
        </span>
      </button>
    </aside>
  );

  // Mobile drawer.
  return (
    <>
      {rail}

      {sidebarMobileOpen ? (
        <div
          className="fixed inset-0 z-40 bg-text/40 backdrop-blur-[1px] md:hidden"
          aria-hidden="true"
          onClick={() => dispatch(closeSidebarMobile())}
        />
      ) : null}
      <aside
        className={cn(
          'bg-surface shadow-shell fixed inset-y-0 left-0 z-50 flex w-64 flex-col transition-transform md:hidden',
          sidebarMobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2.5 px-5">
          <BrandGlyph />
          <span className="text-text font-display text-lg font-semibold tracking-tight">
            Calcula aí
          </span>
        </div>
        <nav aria-label="Menu" className="flex flex-1 flex-col gap-0.5 p-3">
          <span className="text-text-subtle px-3 pt-1 pb-2 text-[0.7rem] font-semibold tracking-wider uppercase">
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
                  'focus-visible:ring-focus-ring flex items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none',
                  active
                    ? 'bg-primary-soft text-primary'
                    : 'text-text-muted hover:bg-surface-2 hover:text-text',
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-border border-t p-3">
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sair"
            className="text-text-muted hover:bg-danger-soft hover:text-danger focus-visible:ring-focus-ring flex w-full items-center gap-3 rounded-btn px-3 py-2.5 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
          >
            <LogOut className="h-4.5 w-4.5 shrink-0" aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}