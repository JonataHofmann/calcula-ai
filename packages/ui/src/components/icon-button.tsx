import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Obrigatório: botão só-ícone precisa de nome acessível (§10). */
  'aria-label': string;
  size?: 'sm' | 'md';
  /** Ponto de notificação (coral) no canto sup. direito. */
  dot?: boolean;
}

/* Spec §7: 36×36, r-pill, fundo transparente → hover surface-2, ícone 18 text-2.
   Mesmo token de transição dos demais controles (§5 transition-colors 150ms). */
const sizeClasses = {
  sm: 'h-8 w-8 [&_svg]:h-4.5 [&_svg]:w-4.5',
  md: 'h-9 w-9 [&_svg]:h-4.5 [&_svg]:w-4.5',
} as const;

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = 'md', dot = false, className, children, type = 'button', ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'text-text-muted hover:bg-surface-2 hover:text-text focus-visible:ring-focus-ring relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-45',
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {children}
      {dot ? (
        <span
          aria-hidden="true"
          className="bg-danger ring-surface absolute top-1.5 right-1.5 h-2 w-2 rounded-full ring-2"
        />
      ) : null}
    </button>
  );
});
