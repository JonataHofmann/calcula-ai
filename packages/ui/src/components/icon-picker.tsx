'use client';

import { useMemo, useState } from 'react';
import { ICONS, ICON_GROUPS, type IconKey } from '@finance/contracts';
import { cn } from '../lib/cn.js';
import { getIcon } from '../lib/icon-map.js';
import { SearchField } from './search-field.js';

export interface IconPickerProps {
  value?: IconKey;
  onChange: (value: IconKey) => void;
  label?: string;
  error?: string;
}

/** Search label per key (Portuguese when available), used for the tooltip and search match. */
const LABEL_BY_KEY = new Map(ICONS.map((i) => [i.key, i.label]));

function IconButton({
  iconKey,
  selected,
  onChange,
}: {
  iconKey: IconKey;
  selected: boolean;
  onChange: (value: IconKey) => void;
}) {
  const Icon = getIcon(iconKey);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={iconKey}
      title={LABEL_BY_KEY.get(iconKey) ?? iconKey}
      onClick={() => onChange(iconKey)}
      className={cn(
        'rounded-icon flex aspect-square items-center justify-center border transition-colors',
        'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
        selected
          ? 'border-primary bg-primary-soft text-primary'
          : 'border-transparent text-text-muted hover:bg-surface-2 hover:text-text',
      )}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

export function IconPicker({ value, onChange, label, error }: IconPickerProps) {
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();

  const searchResults = useMemo(() => {
    if (!q) return null;
    return ICONS.filter((i) => i.label.includes(q) || i.key.includes(q));
  }, [q]);

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
        className="border-border rounded-btn flex max-h-64 flex-col gap-3 overflow-y-auto border p-2"
      >
        {searchResults ? (
          searchResults.length > 0 ? (
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
              {searchResults.map((option) => (
                <IconButton
                  key={option.key}
                  iconKey={option.key}
                  selected={option.key === value}
                  onChange={onChange}
                />
              ))}
            </div>
          ) : (
            <p className="text-text-muted py-4 text-center text-sm">Nenhum ícone encontrado.</p>
          )
        ) : (
          ICON_GROUPS.map((group) => (
            <section key={group.label} className="flex flex-col gap-1.5">
              <h4 className="text-text-muted px-0.5 text-xs font-medium tracking-wide">
                {group.label}
              </h4>
              <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
                {group.keys.map((iconKey) => (
                  <IconButton
                    key={iconKey}
                    iconKey={iconKey}
                    selected={iconKey === value}
                    onChange={onChange}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}
