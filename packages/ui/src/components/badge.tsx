import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

/* Spec §7: h26, r-pill, padding 0 12, 12/600. Neutro (surface-2), índigo (texto
   branco), âmbar (warning) e demais status. */
const variantClasses: Record<NonNullable<BadgeProps['variant']>, string> = {
  default: 'bg-surface-2 text-text-muted',
  primary: 'bg-primary text-primary-foreground',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export function Badge({ variant = 'default', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-6.5 items-center rounded-full px-3 text-xs font-semibold',
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}
