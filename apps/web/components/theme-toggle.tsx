'use client';

import { Monitor, Moon, Sun } from 'lucide-react';
import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/use-store';
import { setTheme, type Theme } from '../store/ui-slice';

const THEME_LABELS: Record<Theme, string> = {
  light: 'claro',
  dark: 'escuro',
  system: 'do sistema',
};

const NEXT_THEME: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
};

function applyTheme(theme: Theme) {
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', dark);
}

export function ThemeToggle({ className }: { className?: string }) {
  const theme = useAppSelector((state) => state.ui.theme);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const stored = localStorage.getItem('theme') as Theme | null;
    if (stored && stored !== theme && ['light', 'dark', 'system'].includes(stored)) {
      dispatch(setTheme(stored));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  function handleToggle() {
    const next = NEXT_THEME[theme];
    dispatch(setTheme(next));
    localStorage.setItem('theme', next);
    applyTheme(next);
  }

  const Icon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Monitor;

  return (
    <button
      type="button"
      onClick={handleToggle}
      aria-label={`Tema atual: ${THEME_LABELS[theme]}. Alternar tema`}
      className={`border-border bg-surface text-text hover:bg-background focus-visible:ring-focus-ring inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors focus-visible:ring-2 focus-visible:outline-none ${className ?? ''}`}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
