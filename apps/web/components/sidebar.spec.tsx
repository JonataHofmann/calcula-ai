import { configureStore } from '@reduxjs/toolkit';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { uiReducer } from '../store/ui-slice';
import { Sidebar } from './sidebar';

const pathnameMock = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock.current,
}));

function renderSidebar(preloadedState?: {
  ui: { theme: 'light' | 'dark' | 'system'; sidebarOpen: boolean; sidebarMobileOpen: boolean };
}) {
  const store = configureStore({ reducer: { ui: uiReducer }, preloadedState });
  const view = render(
    <Provider store={store}>
      <Sidebar />
    </Provider>,
  );
  return { store, ...view };
}

afterEach(() => {
  cleanup();
  pathnameMock.current = '/';
});

describe('Sidebar', () => {
  it('renders the 6 navigation items', () => {
    renderSidebar();
    const nav = screen.getAllByRole('navigation', { name: 'Menu principal' })[0]!;
    for (const label of ['Visão Geral', 'Contas', 'Transações', 'Cartões', 'Orçamentos', 'Metas']) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it('marks active item with aria-current="page"', () => {
    pathnameMock.current = '/contas';
    renderSidebar();
    const active = screen
      .getAllByRole('link', { name: /Contas/ })
      .find((link) => link.getAttribute('aria-current') === 'page');
    expect(active).toBeDefined();
    const inactive = screen.getAllByRole('link', { name: /Metas/ })[0]!;
    expect(inactive).not.toHaveAttribute('aria-current');
  });

  it('collapses via toggle button updating Redux state', () => {
    const { store } = renderSidebar();
    const toggle = screen.getByRole('button', { name: 'Recolher menu' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(store.getState().ui.sidebarOpen).toBe(false);
    expect(screen.getByRole('button', { name: 'Expandir menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('closes mobile overlay on Escape', () => {
    const { store } = renderSidebar({
      ui: { theme: 'system', sidebarOpen: true, sidebarMobileOpen: true },
    });
    expect(store.getState().ui.sidebarMobileOpen).toBe(true);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(store.getState().ui.sidebarMobileOpen).toBe(false);
  });
});
