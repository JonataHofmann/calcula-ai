import { cn } from '../lib/cn.js';

export interface CreditCardVisualProps {
  brand?: string;
  holderName: string;
  maskedNumber: string;
  expiry?: string;
  tone?: 'dark' | 'primary';
  className?: string;
}

export function CreditCardVisual({
  brand,
  holderName,
  maskedNumber,
  expiry,
  tone = 'dark',
  className,
}: CreditCardVisualProps) {
  return (
    <div
      className={cn(
        'flex aspect-[8/5] w-full max-w-xs flex-col justify-between rounded-xl p-5 shadow-md',
        tone === 'dark'
          ? 'bg-surface-strong text-surface-strong-foreground'
          : 'bg-primary text-primary-foreground',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <span className="text-sm font-semibold tracking-wide uppercase">{brand ?? 'Cartão'}</span>
      </div>
      <p className="font-mono text-lg tracking-widest">{maskedNumber}</p>
      <div className="flex items-end justify-between gap-2 text-sm">
        <div className="min-w-0">
          <p className="text-xs uppercase opacity-70">Titular</p>
          <p className="truncate font-medium">{holderName}</p>
        </div>
        {expiry ? (
          <div className="text-right">
            <p className="text-xs uppercase opacity-70">Validade</p>
            <p className="font-medium">{expiry}</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
