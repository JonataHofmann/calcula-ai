import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

/** 'month' = a whole calendar month (default); 'range' = an arbitrary day span. */
export type PeriodMode = 'month' | 'range';

export interface PeriodState {
  mode: PeriodMode;
  /** Anchor month (month mode), also kept in sync as a range's start month. */
  year: number;
  /** 0-11. */
  month: number;
  /** Inclusive range start (range mode), 'YYYY-MM-DD'. */
  from: string;
  /** Inclusive range end (range mode), 'YYYY-MM-DD'. */
  to: string;
}

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function currentMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}

/** Parse 'YYYY-MM-DD' into numeric [year, month(1-12), day]. */
function parseIso(value: string): [number, number, number] {
  const parts = value.split('-');
  return [Number(parts[0]), Number(parts[1]), Number(parts[2])];
}

const initialState: PeriodState = {
  mode: 'month',
  ...currentMonth(),
  from: '',
  to: '',
};

const periodSlice = createSlice({
  name: 'period',
  initialState,
  reducers: {
    setMonth(state, action: PayloadAction<{ year: number; month: number }>) {
      state.mode = 'month';
      state.year = action.payload.year;
      state.month = action.payload.month;
    },
    prevMonth(state) {
      const d = new Date(state.year, state.month - 1, 1);
      state.mode = 'month';
      state.year = d.getFullYear();
      state.month = d.getMonth();
    },
    nextMonth(state) {
      const d = new Date(state.year, state.month + 1, 1);
      state.mode = 'month';
      state.year = d.getFullYear();
      state.month = d.getMonth();
    },
    thisMonth(state) {
      const { year, month } = currentMonth();
      state.mode = 'month';
      state.year = year;
      state.month = month;
    },
    setRange(state, action: PayloadAction<{ from: string; to: string }>) {
      const { from, to } = action.payload;
      const [lo, hi] = from <= to ? [from, to] : [to, from];
      state.mode = 'range';
      state.from = lo;
      state.to = hi;
      // Keep the month anchor on the range start so stepping months stays graceful.
      const [y, m] = parseIso(lo);
      state.year = y;
      state.month = m - 1;
    },
  },
});

/**
 * Query window ({ dueFrom, dueTo }) for the active period. Datas são instantes UTC (dia = `T00:00Z`,
 * casando com `dateToIso`); o fim é o último ms do período (limite inclusivo, casa com o
 * `due_date <= dueTo` da API). Construir em meia-noite LOCAL empurrava o dia 1 pro mês anterior
 * em fusos negativos (BRT → `03:00Z`).
 */
export function periodWindow(period: PeriodState): { dueFrom: string; dueTo: string } {
  if (period.mode === 'range' && period.from && period.to) {
    const [y1, m1, d1] = parseIso(period.from);
    const [y2, m2, d2] = parseIso(period.to);
    const start = Date.UTC(y1, m1 - 1, d1);
    const end = Date.UTC(y2, m2 - 1, d2 + 1) - 1; // último ms do dia `to` (inclusivo)
    return { dueFrom: new Date(start).toISOString(), dueTo: new Date(end).toISOString() };
  }
  const start = Date.UTC(period.year, period.month, 1);
  const end = Date.UTC(period.year, period.month + 1, 1) - 1; // último ms do mês
  return { dueFrom: new Date(start).toISOString(), dueTo: new Date(end).toISOString() };
}

/** 'YYYY-MM-DD' → 'dd/mm/yyyy'. */
function shortDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

/** Human label for the trigger, e.g. 'Janeiro 2026' or '01/02/2026 – 15/02/2026'. */
export function periodLabel(period: PeriodState): string {
  if (period.mode === 'range' && period.from && period.to) {
    return `${shortDate(period.from)} – ${shortDate(period.to)}`;
  }
  return `${MONTHS[period.month]} ${period.year}`;
}

export const { setMonth, prevMonth, nextMonth, thisMonth, setRange } = periodSlice.actions;
export const periodReducer = periodSlice.reducer;
