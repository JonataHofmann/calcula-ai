import type { ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export interface DragGhostProps {
  /** Conteúdo do fantasma. */
  children: ReactNode;
  /** Largura fixa (opcional). */
  width?: number;
  className?: string;
}

/* Spec §7: DragGhost — preview ao arrastar (BoardCard, ListRow). bg-surface, shadow-lift, r-card.
   Opacidade 0.9, pointer-events-none. Usado por libs de DnD (ex: dnd-kit). */
export function DragGhost({ children, width, className }: DragGhostProps) {
  return (
    <div
      className={cn(
        'bg-surface rounded-card shadow-lift opacity-90 pointer-events-none transition-none',
        className,
      )}
      style={width ? { width } : undefined}
    >
      {children}
    </div>
  );
}