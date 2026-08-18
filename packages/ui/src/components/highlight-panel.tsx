import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface HighlightPanelProps {
  /** Título. */
  title: string;
  /** Valor principal (grande). */
  value: ReactNode;
  /** Variação/delta. */
  delta?: { value: string; negative?: boolean; label?: string };
  /** Ícone decorativo. */
  icon?: ReactNode;
  /** Tom do painel. */
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  /** Ação no rodapé. */
  action?: ReactNode;
  className?: string;
}

/* Spec §7: HighlightPanel — painel de destaque (KPI grande). bg-surface (ou tom), shadow-card, r-card.
   Valor em display font 3xl. Delta com seta. Tom aplica cor de fundo suave + texto. */
const toneClasses = {
  default: 'bg-surface text-text',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
} as const;

export function HighlightPanel({
  title,
  value,
  delta,
  icon,
  tone = 'default',
  action,
  className,
}: HighlightPanelProps) {
  return (
    <div className={cn('rounded-card shadow-card p-5', toneClasses[tone], className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium opacity-80">{title}</p>
          {icon ? <span aria-hidden="true" className="opacity-60">{icon}</span> : null}
        </div>
      </div>
      <div className="mt-3">
        <p className="text-3xl font-semibold tracking-tight font-display">{value}</p>
        {delta ? (
          <p className="mt-1 flex items-center gap-1 text-sm font-medium">
            {delta.negative ? '−' : '+'}{delta.value}
            {delta.label ? <span className="opacity-70">{delta.label}</span> : null}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="mt-4 border-t border-current/20 pt-3">{action}</div>
      ) : null}
    </div>
  );
}