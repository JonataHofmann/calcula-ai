import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { formatBRL, formatPercent } from '../lib/format.js';

export interface MetricCardProps {
  title: string;
  value: string;
  delta?: string;
  deltaLabel?: string;
  icon?: ReactNode;
  tone?: 'default' | 'strong';
  className?: string;
}

export function MetricCard({
  title,
  value,
  delta,
  deltaLabel,
  icon,
  tone = 'default',
  className,
}: MetricCardProps) {
  const negativeDelta = delta?.startsWith('-') ?? false;
  const strong = tone === 'strong';

  return (
    <div
      className={cn(
        'rounded-lg border p-4 shadow-sm',
        strong
          ? 'bg-surface-strong text-surface-strong-foreground border-transparent'
          : 'bg-surface text-text border-border',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={cn('text-sm', strong ? 'opacity-80' : 'text-text-muted')}>{title}</p>
        {icon ? <span aria-hidden="true">{icon}</span> : null}
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight">{formatBRL(value)}</p>
      {delta ? (
        <p className="mt-1 flex items-center gap-1 text-sm">
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              strong ? undefined : negativeDelta ? 'text-danger' : 'text-success',
            )}
          >
            {negativeDelta ? (
              <ArrowDownRight className="h-4 w-4" aria-hidden="true" />
            ) : (
              <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
            )}
            {formatPercent(delta, true)}
          </span>
          {deltaLabel ? (
            <span className={strong ? 'opacity-80' : 'text-text-muted'}>{deltaLabel}</span>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
