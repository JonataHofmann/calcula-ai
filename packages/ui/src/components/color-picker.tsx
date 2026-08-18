'use client';

import { Check } from 'lucide-react';
import { COLORS, type ColorToken } from '@finance/contracts';
import { cn } from '../lib/cn.js';
import { COLOR_TOKEN_BG } from '../lib/color-token.js';

export interface ColorPickerProps {
  value?: ColorToken;
  onChange: (value: ColorToken) => void;
  label?: string;
  error?: string;
}

export function ColorPicker({ value, onChange, label, error }: ColorPickerProps) {
  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-text text-sm font-medium">{label}</span> : null}
      <div role="radiogroup" aria-label={label ?? 'Cores'} className="flex flex-wrap gap-2">
        {COLORS.map((option) => {
          const selected = option.token === value;
          return (
            <button
              key={option.token}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              title={option.label}
              onClick={() => onChange(option.token)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-full text-white transition-transform',
                'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                COLOR_TOKEN_BG[option.token],
                selected ? 'ring-focus-ring scale-110 ring-2 ring-offset-2' : 'hover:scale-105',
              )}
            >
              {selected ? <Check className="h-4 w-4" /> : null}
            </button>
          );
        })}
      </div>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}
