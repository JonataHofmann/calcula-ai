import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';
import { StatusDot, type StatusTone } from './status-dot.js';

export interface ListRowProps extends HTMLAttributes<HTMLDivElement> {
  /** Coluna principal (nome/descrição). */
  primary: React.ReactNode;
  /** Coluna secundária (meta, categoria, etc.). */
  secondary?: React.ReactNode;
  /** Coluna de valor (monetário). */
  amount?: { value: string; negative?: boolean };
  /** Badge de status. */
  status?: { tone: StatusTone; label: string };
  /** Ações à direita (ex: menu). */
  actions?: React.ReactNode;
}

/* Spec §7: ListRow — linha de lista/tabela densa. bg-surface, r-btn, hover:bg-surface-2.
   Separação por divide-border (hairline) no container pai. */
export const ListRow = forwardRef<HTMLDivElement, ListRowProps>(function ListRow(
  { primary, secondary, amount, status, actions, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-surface rounded-btn hover:bg-surface-2 transition-colors duration-150 flex items-center gap-3 px-3 py-2.5',
        className,
      )}
      {...props}
    >
      <div className="min-w-0 flex-1">{primary}</div>
      {secondary ? <div className="text-text-muted text-sm shrink-0 w-40 truncate">{secondary}</div> : null}
      {status ? (
        <span className="flex items-center gap-1.5 shrink-0">
          <StatusDot tone={status.tone} />
          <span className="text-text-muted text-sm">{status.label}</span>
        </span>
      ) : null}
      {amount ? (
        <span
          className={cn(
            'shrink-0 text-sm font-semibold tabular-nums',
            amount.negative ? 'text-danger' : 'text-success',
          )}
        >
          {amount.negative ? '-' : '+'}{amount.value}
        </span>
      ) : null}
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
});

export interface ListProps {
  children: React.ReactNode;
  className?: string;
}

/* Container com divide-border entre linhas (spec §1.4: separação por hairline). */
export function List({ children, className }: ListProps) {
  return <div className={cn('divide-border divide-y', className)}>{children}</div>;
}