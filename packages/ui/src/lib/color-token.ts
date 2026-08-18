import type { ColorToken } from '@finance/contracts';

/**
 * Static Tailwind class strings per color token. Literal strings are required so
 * Tailwind's compiler can see them (no dynamic `bg-${token}`).
 */
export const COLOR_TOKEN_BG: Record<ColorToken, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
  orange: 'bg-orange-500',
  teal: 'bg-teal-500',
  indigo: 'bg-indigo-500',
  pink: 'bg-pink-500',
  lime: 'bg-lime-500',
  emerald: 'bg-emerald-500',
  sky: 'bg-sky-500',
  fuchsia: 'bg-fuchsia-500',
  slate: 'bg-slate-500',
};

export const COLOR_TOKEN_SOFT_BG: Record<ColorToken, string> = {
  primary: 'bg-info-soft',
  accent: 'bg-warning-soft',
  success: 'bg-success-soft',
  danger: 'bg-danger-soft',
  warning: 'bg-warning-soft',
  info: 'bg-info-soft',
  orange: 'bg-orange-100',
  teal: 'bg-teal-100',
  indigo: 'bg-indigo-100',
  pink: 'bg-pink-100',
  lime: 'bg-lime-100',
  emerald: 'bg-emerald-100',
  sky: 'bg-sky-100',
  fuchsia: 'bg-fuchsia-100',
  slate: 'bg-slate-100',
};

export const COLOR_TOKEN_TEXT: Record<ColorToken, string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
  orange: 'text-orange-600',
  teal: 'text-teal-600',
  indigo: 'text-indigo-600',
  pink: 'text-pink-600',
  lime: 'text-lime-700',
  emerald: 'text-emerald-600',
  sky: 'text-sky-600',
  fuchsia: 'text-fuchsia-600',
  slate: 'text-slate-600',
};
