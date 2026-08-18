import { cn } from '../lib/cn.js';

export type ProgressTone = 'primary' | 'success' | 'warning' | 'danger';

export interface ProgressBarProps {
  /** Progress in the range 0–100. Values outside are clamped. */
  value: number;
  tone?: ProgressTone;
  label?: string;
  className?: string;
}

const toneClasses: Record<ProgressTone, string> = {
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export function ProgressBar({ value, tone = 'primary', label, className }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value));

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('bg-border h-0.75 w-full overflow-hidden rounded-full', className)}
    >
      <div
        className={cn('h-full rounded-full transition-all', toneClasses[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}
