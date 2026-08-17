import { describe, expect, it } from 'vitest';
import {
  closeSidebarMobile,
  setTheme,
  toggleSidebar,
  toggleSidebarMobile,
  uiReducer,
} from './ui-slice';

const initial = uiReducer(undefined, { type: 'init' });

describe('ui-slice', () => {
  it('has expected initial state', () => {
    expect(initial).toEqual({ theme: 'system', sidebarOpen: true, sidebarMobileOpen: false });
  });

  it('sets theme', () => {
    expect(uiReducer(initial, setTheme('dark')).theme).toBe('dark');
  });

  it('toggles sidebar', () => {
    const next = uiReducer(initial, toggleSidebar());
    expect(next.sidebarOpen).toBe(false);
    expect(uiReducer(next, toggleSidebar()).sidebarOpen).toBe(true);
  });

  it('toggles mobile sidebar', () => {
    const next = uiReducer(initial, toggleSidebarMobile());
    expect(next.sidebarMobileOpen).toBe(true);
  });

  it('closes mobile sidebar', () => {
    const open = uiReducer(initial, toggleSidebarMobile());
    expect(uiReducer(open, closeSidebarMobile()).sidebarMobileOpen).toBe(false);
    expect(uiReducer(initial, closeSidebarMobile()).sidebarMobileOpen).toBe(false);
  });
});
