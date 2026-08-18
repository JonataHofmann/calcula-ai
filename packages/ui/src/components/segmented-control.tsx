import { cn } from '../lib/cn.js';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SegmentedControlProps<T extends string = string> {
  options: SegmentedOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  /** Pílula ativa: 'surface' (branca + shadow-card) ou 'primary' (índigo). */
  activeTone?: 'surface' | 'primary';
  'aria-label'?: string;
  className?: string;
}

/* Spec §7: trilho surface-2 pill, padding 4; item ativo = pílula branca com
   shadow-card (ou índigo). Inativo = text-2, hover text-1. */
export function SegmentedControl<T extends string = string>({
  options,
  value,
  onValueChange,
  activeTone = 'surface',
  'aria-label': ariaLabel,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('bg-surface-2 inline-flex items-center gap-1 rounded-full p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'focus-visible:ring-focus-ring rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none',
              active
                ? activeTone === 'primary'
                  ? 'bg-primary text-primary-foreground shadow-card'
                  : 'bg-surface text-text shadow-card'
                : 'text-text-muted hover:text-text',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
