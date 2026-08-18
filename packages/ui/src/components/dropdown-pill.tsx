import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface DropdownPillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Ícone opcional à esquerda do rótulo. */
  leadingIcon?: ReactNode;
}

/* Spec §7: trigger h36, surface-2, r-pill, rótulo + chevron. Puramente visual —
   quem consome pluga o menu/popover. Deriva do pill de controle (§5). */
export const DropdownPill = forwardRef<HTMLButtonElement, DropdownPillProps>(function DropdownPill(
  { leadingIcon, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'bg-surface-2 text-text hover:bg-border/60 focus-visible:ring-focus-ring inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-45',
        className,
      )}
      {...props}
    >
      {leadingIcon ? (
        <span aria-hidden="true" className="text-text-muted [&_svg]:h-4 [&_svg]:w-4">
          {leadingIcon}
        </span>
      ) : null}
      <span className="truncate">{children}</span>
      <ChevronDown aria-hidden="true" className="text-text-muted h-4 w-4 shrink-0" />
    </button>
  );
});
