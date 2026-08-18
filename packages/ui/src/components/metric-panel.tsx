import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { MetricCard, type MetricCardProps } from './metric-card.js';

export interface MetricPanelProps {
  /** Título do painel (opcional). */
  title?: string;
  /** Subtítulo/descrição. */
  subtitle?: string;
  /** Ações no cabeçalho (ex: Select de período). */
  actions?: ReactNode;
  /** Itens: cada um vira um MetricCard. */
  items: MetricCardProps[];
  className?: string;
}

/* Spec §7: MetricPanel — grade de MetricCards com cabeçalho opcional.
   Grid responsivo: 1 col <640, 2 col <1024, 4 col ≥1024. Gap 6. */
export function MetricPanel({ title, subtitle, actions, items, className }: MetricPanelProps) {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {(title || actions) ? (
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {title ? <h2 className="text-text font-semibold">{title}</h2> : null}
            {subtitle ? <p className="text-text-muted text-sm">{subtitle}</p> : null}
          </div>
          {actions ? <div className="shrink-0">{actions}</div> : null}
        </header>
      ) : null}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((item, i) => <MetricCard key={i} {...item} />)}
      </div>
    </div>
  );
}