'use client';

import { useMemo, useState } from 'react';
import { ICONS, type IconKey } from '@finance/contracts';
import { cn } from '../lib/cn.js';
import { getIcon } from '../lib/icon-map.js';
import { SearchField } from './search-field.js';

export interface IconPickerProps {
  value?: IconKey;
  onChange: (value: IconKey) => void;
  label?: string;
  error?: string;
}

export function IconPicker({ value, onChange, label, error }: IconPickerProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ICONS;
    return ICONS.filter((i) => i.label.includes(q) || i.key.includes(q));
  }, [query]);

  return (
    <div className="flex flex-col gap-2">
      {label ? <span className="text-text text-sm font-medium">{label}</span> : null}
      <SearchField
        placeholder="Buscar ícone…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Buscar ícone"
      />
      <div
        role="radiogroup"
        aria-label={label ?? 'Ícones'}
        className="border-border grid max-h-52 grid-cols-6 gap-1.5 overflow-y-auto rounded-md border p-2 sm:grid-cols-8"
      >
        {filtered.map((option) => {
          const Icon = getIcon(option.key);
          const selected = option.key === value;
          return (
            <button
              key={option.key}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={option.label}
              title={option.label}
              onClick={() => onChange(option.key)}
              className={cn(
                'flex aspect-square items-center justify-center rounded-md border transition-colors',
                'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
                selected
                  ? 'border-primary bg-info-soft text-primary'
                  : 'border-transparent text-text-muted hover:bg-background hover:text-text',
              )}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}
        {filtered.length === 0 ? (
          <p className="text-text-muted col-span-full py-4 text-center text-sm">
            Nenhum ícone encontrado.
          </p>
        ) : null}
      </div>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}
