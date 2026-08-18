import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface MediaCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Imagem/capa (aspect-ratio 16:9). */
  image?: React.ReactNode;
  /** Título. */
  title: string;
  /** Subtítulo/descrição. */
  subtitle?: string;
  /** Ações no rodapé. */
  actions?: React.ReactNode;
  /** Badge de status no canto da imagem. */
  status?: { tone: 'primary' | 'amber' | 'coral' | 'green' | 'violet' | 'neutral'; label: string };
}

/* Spec §7: MediaCard — card com imagem 16:9 + conteúdo. bg-surface, shadow-card, r-card.
   Imagem cobre topo, status badge no canto sup. dir. */
export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(function MediaCard(
  { image, title, subtitle, actions, status, className, children, ...props },
  ref,
) {
  return (
    <article
      ref={ref}
      className={cn('bg-surface rounded-card shadow-card overflow-hidden flex flex-col', className)}
      {...props}
    >
      {image ? (
        <div className="relative aspect-video w-full overflow-hidden">
          <div className="absolute inset-0">{image}</div>
          {status ? (
            <span
              className={cn(
                'absolute top-2 right-2 rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold',
                {
                  'bg-primary/90 text-primary-foreground': status.tone === 'primary',
                  'bg-warning/90 text-warning-foreground': status.tone === 'amber',
                  'bg-danger/90 text-danger-foreground': status.tone === 'coral',
                  'bg-success/90 text-success-foreground': status.tone === 'green',
                  'bg-violet/90 text-violet-foreground': status.tone === 'violet',
                  'bg-text-subtle/90 text-text': status.tone === 'neutral',
                },
              )}
            >
              {status.label}
            </span>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-text font-semibold text-sm truncate">{title}</h3>
        {subtitle ? <p className="text-text-muted text-xs mt-1 line-clamp-2">{subtitle}</p> : null}
        <div className="mt-auto flex-1">{children}</div>
        {actions ? (
          <footer className="border-border border-t mt-3 pt-3">
            {actions}
          </footer>
        ) : null}
      </div>
    </article>
  );
});