'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, ChevronDown } from 'lucide-react';
import type { ColorToken, IconKey } from '@finance/contracts';
import { cn } from '../lib/cn.js';
import { getIcon } from '../lib/icon-map.js';
import { COLOR_TOKEN_SOFT_BG, COLOR_TOKEN_TEXT } from '../lib/color-token.js';

export interface EntityOption {
  value: string;
  label: string;
  /** Lucide icon key from the design system. */
  icon?: IconKey;
  /** Color token driving the icon badge tint. */
  color?: ColorToken;
  /** Raw hex color (used when no token exists, e.g. card brands). */
  colorHex?: string;
  /** Secondary line, e.g. '•••• 1234'. */
  hint?: string;
  /** Indent level for hierarchical options (categories). */
  depth?: number;
}

export interface EntitySelectProps {
  label?: string;
  error?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  options: EntityOption[];
  id?: string;
  disabled?: boolean;
}

/** Icon badge for an option — token tint, hex tint, or a neutral fallback. */
function OptionIcon({ option }: { option: EntityOption }) {
  const Icon = getIcon(option.icon ?? 'tag');
  if (option.colorHex) {
    return (
      <span
        className="rounded-icon flex h-7 w-7 shrink-0 items-center justify-center"
        style={{ backgroundColor: `${option.colorHex}1a`, color: option.colorHex }}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
    );
  }
  const bg = option.color ? COLOR_TOKEN_SOFT_BG[option.color] : 'bg-surface-2';
  const text = option.color ? COLOR_TOKEN_TEXT[option.color] : 'text-text-muted';
  return (
    <span
      className={cn('rounded-icon flex h-7 w-7 shrink-0 items-center justify-center', bg, text)}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
}

/**
 * Listbox that shows each option with its icon and color. Emits the selected
 * option's `value`. Trigger is a `combobox`; options carry `role="option"`.
 */
export function EntitySelect({
  label,
  error,
  placeholder = 'Selecione',
  value,
  onChange,
  options,
  id,
  disabled,
}: EntitySelectProps) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const listId = `${triggerId}-list`;
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => options.find((o) => o.value === value), [options, value]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="flex flex-col gap-1.5" ref={rootRef}>
      {label ? (
        <span id={`${triggerId}-label`} className="text-text text-sm font-medium">
          {label}
        </span>
      ) : null}
      <div className="relative">
        <button
          type="button"
          id={triggerId}
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          data-value={value}
          disabled={disabled}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'bg-surface text-text rounded-btn flex h-10 w-full items-center gap-2 border px-3.5 text-left text-sm transition-colors',
            'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
            'disabled:pointer-events-none disabled:opacity-50',
            error ? 'border-danger' : 'border-border',
          )}
        >
          {selected ? (
            <>
              <OptionIcon option={selected} />
              <span className="text-text flex-1 truncate">{selected.label}</span>
              {selected.hint ? (
                <span className="text-text-muted text-xs">{selected.hint}</span>
              ) : null}
            </>
          ) : (
            <span className="text-text-muted flex-1">{placeholder}</span>
          )}
          <ChevronDown className="text-text-muted h-4 w-4 shrink-0" aria-hidden="true" />
        </button>

        <AnimatePresence>
          {open ? (
            <motion.ul
              id={listId}
              role="listbox"
              aria-label={label}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
              className="bg-surface border-border shadow-lift absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-card border p-1"
            >
              {options.length === 0 ? (
                <li className="text-text-muted px-3 py-2 text-sm">Nenhuma opção</li>
              ) : (
                options.map((option) => {
                  const isSelected = option.value === value;
                  return (
                    <li key={option.value} role="none">
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        aria-label={option.label}
                        onClick={() => {
                          onChange(option.value);
                          setOpen(false);
                        }}
                        style={
                          option.depth ? { paddingLeft: `${option.depth * 1.25 + 0.5}rem` } : undefined
                        }
                        className={cn(
                          'rounded-btn flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm transition-colors',
                          isSelected ? 'bg-primary-soft text-primary' : 'hover:bg-surface-2',
                        )}
                      >
                        <OptionIcon option={option} />
                        <span className="text-text flex-1 truncate">{option.label}</span>
                        {option.hint ? (
                          <span className="text-text-muted text-xs">{option.hint}</span>
                        ) : null}
                        {isSelected ? (
                          <Check className="text-primary h-4 w-4 shrink-0" aria-hidden="true" />
                        ) : null}
                      </button>
                    </li>
                  );
                })
              )}
            </motion.ul>
          ) : null}
        </AnimatePresence>
      </div>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}
