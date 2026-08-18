'use client';

import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn.js';

export interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> {
  label?: string;
  helpText?: string;
  error?: string;
  /** Decimal string with dot, e.g. '1200.00'; '' when empty. */
  value: string;
  /** Emits a decimal string with dot ('1200.00'); '' when cleared. */
  onChange: (value: string) => void;
}

/** Any string -> cents digit-string, leading zeros stripped ('1.200,00' -> '120000'). */
function toCentsDigits(raw: string): string {
  return raw.replace(/\D/g, '').replace(/^0+/, '');
}

/** cents digits -> decimal string with dot ('120000' -> '1200.00'); '' -> ''. */
function digitsToValue(digits: string): string {
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const int = padded.slice(0, -2).replace(/^0+(?=\d)/, '');
  return `${int}.${padded.slice(-2)}`;
}

/** cents digits -> pt-BR display ('120000' -> '1.200,00'); '' -> ''. */
function digitsToDisplay(digits: string): string {
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const int = padded.slice(0, -2).replace(/^0+(?=\d)/, '');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${grouped},${padded.slice(-2)}`;
}

/**
 * Currency field with a right-to-left cents mask. Digits fill from the right
 * (first key = R$ 0,01), displayed as pt-BR ('1.200,00'); the emitted value is
 * always a two-fraction-digit decimal string with a dot ('1200.00').
 */
export function CurrencyInput({
  label,
  helpText,
  error,
  value,
  onChange,
  className,
  id,
  placeholder = '0,00',
  ...props
}: CurrencyInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const helpId = `${inputId}-help`;
  const errorId = `${inputId}-error`;
  const describedBy = error ? errorId : helpText ? helpId : undefined;
  const display = digitsToDisplay(toCentsDigits(value));

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={inputId} className="text-text text-sm font-medium">
          {label}
        </label>
      ) : null}
      <div className="relative">
        <span
          className="text-text-muted pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm"
          aria-hidden="true"
        >
          R$
        </span>
        <input
          id={inputId}
          inputMode="numeric"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          value={display}
          onChange={(e) => onChange(digitsToValue(toCentsDigits(e.target.value)))}
          placeholder={placeholder}
          className={cn(
            'bg-surface text-text placeholder:text-text-muted h-10 w-full rounded-md border pr-3 pl-9 text-right text-sm tabular-nums transition-colors',
            'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
            'disabled:pointer-events-none disabled:opacity-50',
            error ? 'border-danger' : 'border-border',
            className,
          )}
          {...props}
        />
      </div>
      {error ? (
        <p id={errorId} className="text-danger text-sm">
          {error}
        </p>
      ) : helpText ? (
        <p id={helpId} className="text-text-muted text-sm">
          {helpText}
        </p>
      ) : null}
    </div>
  );
}
