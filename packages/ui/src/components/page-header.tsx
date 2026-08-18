import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';
import { StatusDot, type StatusTone } from './status-dot.js';

export interface PageHeaderProps {
  /** Título principal. */
  title: string;
  /** Subtítulo/descrição. */
  subtitle?: string;
  /** Status badge ao lado do título. */
  status?: { tone: StatusTone; label: string };
  /** Ações à direita (botões, selects). */
  actions?: ReactNode;
  /** Breadcrumbs. */
  breadcrumbs?: { label: string; href?: string }[];
  className?: string;
}

/* Spec §7: PageHeader — cabeçalho de página. Título display + subtitle text-2.
   StatusDot + label opcional. Breadcrumbs acima. Actions à direita. */
export function PageHeader({
  title,
  subtitle,
  status,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('flex flex-col gap-4 md:flex-row md:items-end md:justify-between', className)}>
      <div className="flex flex-col gap-1">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav className="flex items-center gap-1.5 text-text-muted text-xs" aria-label="Navegação">
            {breadcrumbs.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-text-subtle" aria-hidden="true">/</span>}
                {crumb.href ? (
                  <a href={crumb.href} className="hover:text-text transition-colors">
                    {crumb.label}
                  </a>
                ) : (
                  <span className="text-text font-medium">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        ) : null}
        <div className="flex items-baseline gap-2 flex-wrap">
          <h1 className="text-text font-display text-2xl font-semibold tracking-tight">{title}</h1>
          {status ? (
            <span className="flex items-center gap-1.5 self-center">
              <StatusDot tone={status.tone} />
              <span className="text-text-muted text-sm">{status.label}</span>
            </span>
          ) : null}
        </div>
        {subtitle ? <p className="text-text-muted text-sm">{subtitle}</p> : null}
      </div>
      {actions ? <div className="shrink-0 flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}