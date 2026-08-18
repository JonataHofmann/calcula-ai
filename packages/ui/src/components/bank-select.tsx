'use client';

import { useId } from 'react';
import { BANKS, findBank } from '@finance/contracts';
import { cn } from '../lib/cn.js';

export interface BankSelectProps {
  value?: string;
  onChange: (bankId: string) => void;
  label?: string;
  error?: string;
  placeholder?: string;
}

/** Bank chooser: native select for a11y + a color swatch preview of the choice. */
export function BankSelect({
  value,
  onChange,
  label,
  error,
  placeholder = 'Selecione um banco',
}: BankSelectProps) {
  const id = useId();
  const selected = value ? findBank(value) : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={id} className="text-text text-sm font-medium">
          {label}
        </label>
      ) : null}
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="border-border h-9 w-9 shrink-0 rounded-full border"
          style={{ backgroundColor: selected?.color ?? 'transparent' }}
        />
        <select
          id={id}
          value={value ?? ''}
          aria-invalid={error ? true : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'bg-surface text-text rounded-btn h-10 flex-1 border px-3.5 text-sm transition-colors',
            'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
            error ? 'border-danger' : 'border-border',
          )}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {BANKS.map((bank) => (
            <option key={bank.id} value={bank.id}>
              {bank.name}
            </option>
          ))}
        </select>
      </div>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}
