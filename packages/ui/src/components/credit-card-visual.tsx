import { cn } from '../lib/cn.js';
import { formatBRL } from '../lib/format.js';

export interface CreditCardVisualProps {
  brand?: string;
  holderName: string;
  maskedNumber: string;
  expiry?: string;
  /** Decimal string (e.g. "5756.00"); rendered as the card balance when provided. */
  balance?: string;
  tone?: 'dark' | 'primary' | 'light';
  className?: string;
}

function Chip({ muted }: { muted: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'block h-8 w-10 rounded-md',
        muted ? 'bg-text-muted/25' : 'bg-white/40',
      )}
    />
  );
}

function NetworkMark({ muted }: { muted: boolean }) {
  const circle = muted ? 'bg-text-muted/40' : 'bg-white/60';
  return (
    <span aria-hidden="true" className="flex items-center">
      <span className={cn('h-6 w-6 rounded-full', circle)} />
      <span className={cn('-ml-3 h-6 w-6 rounded-full', muted ? 'bg-text-muted/60' : 'bg-white/80')} />
    </span>
  );
}

export function CreditCardVisual({
  brand,
  holderName,
  maskedNumber,
  expiry,
  balance,
  tone = 'dark',
  className,
}: CreditCardVisualProps) {
  const light = tone === 'light';

  const toneClasses =
    tone === 'primary'
      ? 'bg-primary text-primary-foreground'
      : light
        ? 'bg-surface text-text border border-border'
        : 'bg-surface-strong bg-gradient-to-br from-[#4c49ed] to-[#0a06f4] text-white';

  const labelClass = light ? 'text-text-muted' : 'opacity-70';
  const footerClass = light ? 'border-border' : 'border-white/20';

  return (
    <div
      className={cn(
        'flex aspect-[16/10] w-full max-w-sm flex-col justify-between overflow-hidden rounded-2xl shadow-md',
        toneClasses,
        className,
      )}
    >
      {brand ? <span className="sr-only">{brand}</span> : null}

      <div className="flex items-start justify-between gap-2 p-5 pb-0">
        <div className="min-w-0">
          <p className={cn('text-xs', labelClass)}>Saldo</p>
          <p className="mt-0.5 truncate text-xl font-semibold tracking-tight">
            {balance ? formatBRL(balance) : '—'}
          </p>
        </div>
        <Chip muted={light} />
      </div>

      <div className="flex items-end justify-between gap-4 px-5">
        <div className="min-w-0">
          <p className={cn('text-[10px] tracking-wide uppercase', labelClass)}>Titular</p>
          <p className="truncate text-sm font-medium">{holderName}</p>
        </div>
        {expiry ? (
          <div className="text-right">
            <p className={cn('text-[10px] tracking-wide uppercase', labelClass)}>Validade</p>
            <p className="text-sm font-medium">{expiry}</p>
          </div>
        ) : null}
      </div>

      <div className={cn('mt-4 flex items-center justify-between gap-3 border-t px-5 py-4', footerClass)}>
        <p className="font-mono text-base tracking-wider">{maskedNumber}</p>
        <NetworkMark muted={light} />
      </div>
    </div>
  );
}
