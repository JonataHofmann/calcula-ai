'use client';

import { cn } from '@finance/ui';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/use-store';
import {
  nextMonth,
  periodLabel,
  prevMonth,
  setRange,
  thisMonth,
} from '../store/period-slice';

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

/** 'YYYY-MM-DD' from a locally-read Y/M/D. */
function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Global period control. Prev/next step whole months; clicking the centre label
 * opens a calendar where two clicks pick a custom date range. Backed by the
 * `period` store slice, so every consumer (e.g. the transactions list) follows.
 */
export function PeriodSelector({ className }: { className?: string }) {
  const dispatch = useAppDispatch();
  const period = useAppSelector((s) => s.period);
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Popover calendar view + in-progress range selection.
  const [view, setView] = useState({ y: period.year, m: period.month });
  const [pending, setPending] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  // Re-centre and reset the draft selection whenever the popover opens.
  useEffect(() => {
    if (!open) return;
    setView({ y: period.year, m: period.month });
    setPending(null);
    setHover(null);
  }, [open, period.year, period.month]);

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

  // Active endpoints: an in-progress draft (pending + hover) or the stored range.
  const { lo, hi, endpoints } = useMemo(() => {
    let a: string | null = null;
    let b: string | null = null;
    if (pending) {
      a = pending;
      b = hover ?? pending;
    } else if (period.mode === 'range' && period.from && period.to) {
      a = period.from;
      b = period.to;
    }
    if (!a || !b) return { lo: null, hi: null, endpoints: new Set<string>() };
    const [low, high] = a <= b ? [a, b] : [b, a];
    return { lo: low, hi: high, endpoints: new Set([a, b]) };
  }, [pending, hover, period.mode, period.from, period.to]);

  const stepView = (delta: number) => {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  };

  const pickDay = (cellIso: string) => {
    if (!pending) {
      setPending(cellIso);
      setHover(cellIso);
      return;
    }
    dispatch(setRange({ from: pending, to: cellIso }));
    setPending(null);
    setHover(null);
    setOpen(false);
  };

  return (
    <div className={cn('relative flex items-center gap-1', className)} ref={rootRef}>
      <button
        type="button"
        onClick={() => dispatch(prevMonth())}
        aria-label="Mês anterior"
        className="text-text-muted hover:bg-border/40 hover:text-text focus-visible:ring-focus-ring flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="text-text hover:bg-border/40 focus-visible:ring-focus-ring flex h-9 min-w-44 items-center justify-center gap-2 rounded-lg px-3 text-sm font-semibold whitespace-nowrap capitalize transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <Calendar className="text-text-muted h-4 w-4 shrink-0" aria-hidden="true" />
        {periodLabel(period)}
      </button>

      <button
        type="button"
        onClick={() => dispatch(nextMonth())}
        aria-label="Próximo mês"
        className="text-text-muted hover:bg-border/40 hover:text-text focus-visible:ring-focus-ring flex h-9 w-9 items-center justify-center rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open ? (
          <motion.div
            role="dialog"
            aria-label="Selecionar período"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.15, ease: 'easeOut' }}
            className="bg-surface border-border absolute top-full left-1/2 z-30 mt-2 w-80 -translate-x-1/2 rounded-xl border p-3 shadow-lg"
          >
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                aria-label="Mês anterior"
                onClick={() => stepView(-1)}
                className="text-text-muted hover:bg-background hover:text-text rounded-md p-1.5 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-text text-sm font-medium capitalize">
                {MONTHS[view.m]} {view.y}
              </span>
              <button
                type="button"
                aria-label="Próximo mês"
                onClick={() => stepView(1)}
                className="text-text-muted hover:bg-background hover:text-text rounded-md p-1.5 transition-colors"
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

            <div className="grid grid-cols-7 gap-y-1" onMouseLeave={() => pending && setHover(pending)}>
              {cells.map((day, i) => {
                if (day === null) return <span key={`e${i}`} />;
                const cellIso = iso(view.y, view.m, day);
                const isEndpoint = endpoints.has(cellIso);
                const inRange = lo !== null && hi !== null && cellIso >= lo && cellIso <= hi;
                const isLo = cellIso === lo;
                const isHi = cellIso === hi;
                return (
                  <div
                    key={cellIso}
                    className={cn(
                      // Continuous band behind the days that fall inside the range.
                      inRange && !isEndpoint && 'bg-primary/10',
                      inRange && isLo && 'bg-primary/10 rounded-l-md',
                      inRange && isHi && 'bg-primary/10 rounded-r-md',
                      isEndpoint && lo !== hi && isLo && 'bg-primary/10 rounded-l-md',
                      isEndpoint && lo !== hi && isHi && 'bg-primary/10 rounded-r-md',
                    )}
                  >
                    <button
                      type="button"
                      aria-label={cellIso}
                      onClick={() => pickDay(cellIso)}
                      onMouseEnter={() => pending && setHover(cellIso)}
                      className={cn(
                        'flex h-9 w-full items-center justify-center rounded-md text-sm transition-colors',
                        'focus-visible:ring-focus-ring focus-visible:ring-2 focus-visible:outline-none',
                        isEndpoint
                          ? 'bg-primary font-medium text-white'
                          : 'text-text hover:bg-background',
                      )}
                    >
                      {day}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="border-border mt-3 flex items-center justify-between border-t pt-3">
              <span className="text-text-muted text-xs">
                {pending ? 'Escolha o fim do intervalo' : 'Clique em dois dias'}
              </span>
              <button
                type="button"
                onClick={() => {
                  dispatch(thisMonth());
                  setOpen(false);
                }}
                className="text-primary hover:bg-primary/10 focus-visible:ring-focus-ring rounded-md px-2 py-1 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                Este mês
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
