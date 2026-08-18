'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn.js';

export interface DatePickerProps {
  label?: string;
  error?: string;
  /** 'YYYY-MM-DD' or '' when empty. */
  value: string;
  /** Emits 'YYYY-MM-DD'. */
  onChange: (value: string) => void;
  placeholder?: string;
  /** Minimum selectable day, 'YYYY-MM-DD'. */
  min?: string;
  id?: string;
}

const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const MONTHS = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
];

/** 'YYYY-MM-DD' from a Date read in local time. */
function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Human label for the trigger, e.g. '15/01/2026'; '' when empty. */
function displayDate(value: string): string {
  if (!value) return '';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Calendar date picker. The trigger shows the selected date (dd/mm/yyyy); a
 * popover renders a month grid. Emits and stores 'YYYY-MM-DD'.
 */
export function DatePicker({
  label,
  error,
  value,
  onChange,
  placeholder = 'Selecione',
  min,
  id,
}: DatePickerProps) {
  const autoId = useId();
  const triggerId = id ?? autoId;
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(() => {
    if (!value) return null;
    const parts = value.split('-');
    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
    return { y, m: m - 1, d };
  }, [value]);

  const [view, setView] = useState(() => {
    const base = selected ?? { y: new Date().getFullYear(), m: new Date().getMonth() };
    return { y: base.y, m: base.m };
  });

  // Re-center the grid on the selected month whenever the popover opens.
  useEffect(() => {
    if (!open) return;
    const base = selected ?? { y: new Date().getFullYear(), m: new Date().getMonth() };
    setView({ y: base.y, m: base.m });
  }, [open, selected]);

  // Close on outside click / Escape.
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

  const firstWeekday = new Date(view.y, view.m, 1).getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const step = (delta: number) => {
    setView((v) => {
      const next = new Date(v.y, v.m + delta, 1);
      return { y: next.getFullYear(), m: next.getMonth() };
    });
  };

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
          aria-label={label}
          aria-haspopup="dialog"
          aria-expanded={open}
          data-value={value}
          onClick={() => setOpen((o) => !o)}
          className={cn(
            'bg-surface text-text rounded-btn flex h-10 w-full items-center gap-2 border px-3.5 text-left text-sm transition-colors',
            'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
            error ? 'border-danger' : 'border-border',
          )}
        >
          <Calendar className="text-text-muted h-4 w-4 shrink-0" aria-hidden="true" />
          <span className={cn('flex-1', value ? 'text-text' : 'text-text-muted')}>
            {value ? displayDate(value) : placeholder}
          </span>
        </button>

        <AnimatePresence>
          {open ? (
            <motion.div
              role="dialog"
              aria-label={label ?? 'Calendário'}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
              className="bg-surface border-border shadow-lift absolute z-20 mt-1 w-72 rounded-card border p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => step(-1)}
                  className="text-text-muted hover:bg-surface-2 hover:text-text rounded-icon p-1.5 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-text text-sm font-medium capitalize">
                  {MONTHS[view.m]} {view.y}
                </span>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => step(1)}
                  className="text-text-muted hover:bg-surface-2 hover:text-text rounded-icon p-1.5 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-1 grid grid-cols-7 gap-1">
                {WEEKDAYS.map((w, i) => (
                  <span
                    key={i}
                    className="text-text-muted flex h-7 items-center justify-center text-xs font-medium"
                  >
                    {w}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  if (day === null) return <span key={`e${i}`} />;
                  const cellIso = iso(view.y, view.m, day);
                  const isSelected = cellIso === value;
                  const disabled = min ? cellIso < min : false;
                  return (
                    <button
                      key={cellIso}
                      type="button"
                      aria-label={cellIso}
                      aria-pressed={isSelected}
                      disabled={disabled}
                      onClick={() => {
                        onChange(cellIso);
                        setOpen(false);
                      }}
                      className={cn(
                        'flex h-8 items-center justify-center rounded-icon text-sm transition-colors',
                        'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
                        'disabled:pointer-events-none disabled:opacity-30',
                        isSelected
                          ? 'bg-primary font-medium text-white'
                          : 'text-text hover:bg-surface-2',
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
      {error ? <p className="text-danger text-sm">{error}</p> : null}
    </div>
  );
}
