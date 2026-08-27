import { cn } from '../lib/cn.js';
import { formatBRL } from '../lib/format.js';

export interface CreditCardVisualProps {
  brand?: string;
  /** Brand catalog id (visa, mastercard, elo…); drives the on-card brand mark. */
  brandId?: string;
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
        'block h-8 w-10 rounded-icon',
        muted ? 'bg-text-muted/25' : 'bg-white/40',
      )}
    />
  );
}

/** Wordmark labels for brands drawn as text (mastercard is drawn as its circles). */
const BRAND_WORDMARK: Record<string, string> = {
  visa: 'VISA',
  elo: 'elo',
  amex: 'AMEX',
  hipercard: 'Hipercard',
  diners: 'Diners',
  discover: 'DISCOVER',
  jcb: 'JCB',
};

/** Brand logo rendered on the card. Mastercard as its interlocking circles; the
 *  rest as a wordmark in the card's own text color; unknown brands as a contactless mark. */
function BrandMark({ brandId, muted }: { brandId?: string; muted: boolean }) {
  if (brandId === 'mastercard') {
    return (
      <svg aria-hidden="true" viewBox="0 0 48 30" className="h-7 w-auto">
        <circle cx="19" cy="15" r="11" fill="#EB001B" />
        <circle cx="29" cy="15" r="11" fill="#F79E1B" fillOpacity="0.9" />
      </svg>
    );
  }

  const label = brandId ? BRAND_WORDMARK[brandId] : undefined;
  if (label) {
    return (
      <span aria-hidden="true" className="text-base font-black italic leading-none tracking-tight">
        {label}
      </span>
    );
  }

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={cn('h-6 w-6', muted ? 'text-text-muted/50' : 'text-white/70')}
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        d="M8 6a10 10 0 0 1 0 12M12 4a14 14 0 0 1 0 16M16 3a17 17 0 0 1 0 18"
      />
    </svg>
  );
}

export function CreditCardVisual({
  brand,
  brandId,
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
        <BrandMark brandId={brandId} muted={light} />
      </div>
    </div>
  );
}
