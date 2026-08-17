import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type ChartLegendColor = 'primary' | 'accent' | 'success' | 'danger' | 'warning' | 'info';

export interface ChartContainerProps {
  title: string;
  legend?: Array<{ label: string; colorToken: ChartLegendColor }>;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

const legendColorClasses: Record<ChartLegendColor, string> = {
  primary: 'bg-primary',
  accent: 'bg-accent',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-info',
};

export function ChartContainer({
  title,
  legend,
  actions,
  children,
  className,
}: ChartContainerProps) {
  return (
    <section
      className={cn('bg-surface border-border rounded-lg border p-4 shadow-sm', className)}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-text text-sm font-semibold">{title}</h3>
        {actions ? <div>{actions}</div> : null}
      </header>
      {legend && legend.length > 0 ? (
        <ul className="mt-2 flex flex-wrap gap-4">
          {legend.map((entry) => (
            <li key={entry.label} className="text-text-muted flex items-center gap-1.5 text-xs">
              <span
                aria-hidden="true"
                className={cn('h-2.5 w-2.5 rounded-full', legendColorClasses[entry.colorToken])}
              />
              {entry.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}
