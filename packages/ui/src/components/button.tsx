import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';
import { Spinner } from './spinner.js';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

/* Spec §7: primary índigo/branco r-btn · ghost surface-2/text-1 · outline 1px
   hairline/branco/pill. secondary/destructive mantidos por retrocompatibilidade. */
const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary-pressed rounded-btn',
  secondary: 'bg-surface text-text border border-border hover:bg-surface-2 rounded-btn',
  destructive: 'bg-danger text-primary-foreground hover:opacity-90 rounded-btn',
  ghost: 'bg-surface-2 text-text hover:bg-border/60 rounded-btn',
  outline: 'bg-surface text-text border border-border hover:bg-surface-2 rounded-full',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5 [&_svg]:h-4 [&_svg]:w-4',
  md: 'h-10 px-4.5 text-sm gap-2 [&_svg]:h-4 [&_svg]:w-4',
  lg: 'h-12 px-6 text-base gap-2 [&_svg]:h-5 [&_svg]:w-5',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  className,
  type = 'button',
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-colors duration-150',
        'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
        'disabled:pointer-events-none disabled:opacity-45',
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner size="sm" /> : null}
      {children}
    </button>
  );
}
