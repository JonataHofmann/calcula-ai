import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface FabProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obrigatório: FAB só-ícone precisa de nome acessível (§10). */
  'aria-label': string;
}

/* Spec §7: 40 circular índigo, ícone branco, shadow-card; hover shadow-hover. */
export const Fab = forwardRef<HTMLButtonElement, FabProps>(function Fab(
  { className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'bg-primary text-primary-foreground shadow-card hover:bg-primary-pressed hover:shadow-hover focus-visible:ring-focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-45 [&_svg]:h-5 [&_svg]:w-5',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});
