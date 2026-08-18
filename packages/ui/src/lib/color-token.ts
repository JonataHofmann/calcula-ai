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
};

export const COLOR_TOKEN_SOFT_BG: Record<ColorToken, string> = {
  primary: 'bg-info-soft',
  accent: 'bg-warning-soft',
  success: 'bg-success-soft',
  danger: 'bg-danger-soft',
  warning: 'bg-warning-soft',
  info: 'bg-info-soft',
};

export const COLOR_TOKEN_TEXT: Record<ColorToken, string> = {
  primary: 'text-primary',
  accent: 'text-accent',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  info: 'text-info',
};
