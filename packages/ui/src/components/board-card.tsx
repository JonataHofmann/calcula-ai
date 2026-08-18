import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface BoardCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Ícone opcional à esquerda do título. */
  leadingIcon?: React.ReactNode;
  /** Badge de status opcional à direita. */
  status?: { tone: 'primary' | 'amber' | 'coral' | 'green' | 'violet' | 'neutral'; label: string };
  /** Valor monetário opcional (ex: transação). */
  amount?: { value: string; negative?: boolean };
}

/* Spec §7: BoardCard — card arrastável. bg-surface, shadow-card, r-card.
   Hover: shadow-hover + -translate-y-px. Conteúdo: leadingIcon + título + status + amount. */
export const BoardCard = forwardRef<HTMLDivElement, BoardCardProps>(function BoardCard(
  { leadingIcon, status, amount, children, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-surface rounded-card shadow-card p-3 transition-[box-shadow,transform] duration-150 hover:-translate-y-px hover:shadow-hover',
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {leadingIcon ? (
            <span className="bg-surface-2 text-text-muted flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
              {leadingIcon}
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="text-text text-sm font-medium truncate">{children}</p>
          </div>
        </div>
        {status ? (
          <span
            className={cn(
              'shrink-0 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
              {
                'bg-primary-soft text-primary': status.tone === 'primary',
                'bg-warning-soft text-warning': status.tone === 'amber',
                'bg-danger-soft text-danger': status.tone === 'coral',
                'bg-success-soft text-success': status.tone === 'green',
                'bg-violet-soft text-violet': status.tone === 'violet',
                'bg-surface-2 text-text-muted': status.tone === 'neutral',
              },
            )}
          >
            {status.label}
          </span>
        ) : null}
      </div>
      {amount ? (
        <p
          className={cn(
            'mt-2 text-sm font-semibold tabular-nums',
            amount.negative ? 'text-danger' : 'text-success',
          )}
        >
          {amount.negative ? '-' : '+'}{amount.value}
        </p>
      ) : null}
    </div>
  );
});