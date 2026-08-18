import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface SidePanelItemProps extends HTMLAttributes<HTMLDivElement> {
  /** Conteúdo principal. */
  children: React.ReactNode;
  /** Ação secundária (ex: ícone de editar/excluir). */
  trailing?: React.ReactNode;
  /** Se está selecionado. */
  selected?: boolean;
}

/* Spec §7: SidePanelItem — item de painel lateral (360px). bg-surface, r-btn, hover:bg-surface-2.
   Selecionado = bg-primary-soft text-primary. */
export const SidePanelItem = forwardRef<HTMLDivElement, SidePanelItemProps>(function SidePanelItem(
  { children, trailing, selected = false, className, ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'bg-surface rounded-btn p-3 transition-colors duration-150 hover:bg-surface-2',
        selected && 'bg-primary-soft text-primary',
        className,
      )}
      {...props}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">{children}</div>
        {trailing ? <div className="shrink-0 text-text-muted">{trailing}</div> : null}
      </div>
    </div>
  );
});

export interface SidePanelListProps {
  /** Título do painel. */
  title?: string;
  /** Itens. */
  children: React.ReactNode;
  /** Ação no cabeçalho. */
  headerAction?: React.ReactNode;
  className?: string;
}

/* Spec §7: SidePanelList — container do painel direito (360px). Fundo surface-2, r-card. */
export function SidePanelList({ title, children, headerAction, className }: SidePanelListProps) {
  return (
    <aside className={cn('bg-surface-2 rounded-card flex flex-col h-full', className)}>
      {(title || headerAction) ? (
        <header className="flex items-center justify-between border-border border-b p-3">
          {title ? <h3 className="text-text font-semibold text-sm">{title}</h3> : null}
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </header>
      ) : null}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">{children}</div>
    </aside>
  );
}