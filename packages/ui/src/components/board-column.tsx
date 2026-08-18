import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { StatusDot, type StatusTone } from './status-dot.js';

export interface BoardColumnProps {
  title: string;
  count?: number;
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}

/* Spec §7: BoardColumn — coluna kanban. Cabeça com título + StatusDot + contador.
   Fundo surface-2, r-card, sem borda. Crianças = BoardCards empilhados. */
export function BoardColumn({ title, count, tone, children, className }: BoardColumnProps) {
  return (
    <section className={cn('bg-surface-2 rounded-card flex flex-col min-w-0', className)}>
      <header className="flex items-center justify-between gap-2 p-4 border-border border-b">
        <div className="flex items-center gap-2">
          <h3 className="text-text font-semibold text-sm">{title}</h3>
          {tone ? <StatusDot tone={tone} /> : null}
        </div>
        {count !== undefined ? (
          <span className="bg-surface text-text-muted rounded-full px-2 py-0.5 text-xs font-medium">
            {count}
          </span>
        ) : null}
      </header>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">{children}</div>
    </section>
  );
}