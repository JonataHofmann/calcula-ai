import { configureStore } from '@reduxjs/toolkit';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uiReducer } from '../store/ui-slice';
import { ThemeToggle } from './theme-toggle';

function makeStore() {
  return configureStore({ reducer: { ui: uiReducer } });
}

function renderWithStore(ui: ReactNode, store = makeStore()) {
  return { store, ...render(<Provider store={store}>{ui}</Provider>) };
}

function mockMatchMedia(matches: boolean) {
  const listeners: Array<() => void> = [];
  const mql = {
    matches,
    media: '(prefers-color-scheme: dark)',
    addEventListener: vi.fn((_: string, cb: () => void) => listeners.push(cb)),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => mql),
  );
  return { mql, listeners };
}

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
    mockMatchMedia(false);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('cycles system -> light -> dark and persists to localStorage', () => {
    renderWithStore(<ThemeToggle />);
    const button = screen.getByRole('button');

    expect(button).toHaveAccessibleName(/do sistema/);

    fireEvent.click(button);
    expect(localStorage.getItem('theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(button).toHaveAccessibleName(/claro/);

    fireEvent.click(button);
    expect(localStorage.getItem('theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(button).toHaveAccessibleName(/escuro/);
  });

  it('restores persisted theme from localStorage on mount', () => {
    localStorage.setItem('theme', 'dark');
    const { store } = renderWithStore(<ThemeToggle />);
    expect(store.getState().ui.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('follows matchMedia when in system mode', () => {
    const { mql } = mockMatchMedia(true);
    renderWithStore(<ThemeToggle />);
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
