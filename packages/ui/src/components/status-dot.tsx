import { cn } from '../lib/cn.js';

export type StatusTone = 'primary' | 'amber' | 'coral' | 'green' | 'violet' | 'neutral';

export interface StatusDotProps {
  tone?: StatusTone;
  /** Accessible label. When omitted the dot is decorative (aria-hidden). */
  label?: string;
  className?: string;
}

/* Spec §7: 7px circular na cor semântica. Status nunca só por cor — pareie com
   texto/label no componente que o consome. */
const toneClasses: Record<StatusTone, string> = {
  primary: 'bg-primary',
  amber: 'bg-warning',
  coral: 'bg-danger',
  green: 'bg-success',
  violet: 'bg-violet',
  neutral: 'bg-text-subtle',
};

export function StatusDot({ tone = 'neutral', label, className }: StatusDotProps) {
  return (
    <span
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={cn('inline-block h-[7px] w-[7px] shrink-0 rounded-full', toneClasses[tone], className)}
    />
  );
}
