/** Short month labels (Jan–Dez) for chart axes. */
export const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

const FULL_MONTHS = [
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

export interface DateWindow {
  dueFrom: string;
  dueTo: string;
}

/** Query window ({ dueFrom, dueTo }) spanning the whole year, local midnights as UTC instants. */
export function yearWindow(year: number): DateWindow {
  const start = new Date(year, 0, 1);
  const end = new Date(year + 1, 0, 1);
  return { dueFrom: start.toISOString(), dueTo: end.toISOString() };
}

/** Query window spanning a month range (inclusive), from 'YYYY-MM' strings. */
export function monthRangeWindow(fromYM: string, toYM: string): DateWindow {
  const [fy, fm] = fromYM.split('-').map(Number) as [number, number];
  const [ty, tm] = toYM.split('-').map(Number) as [number, number];
  const start = new Date(fy, fm - 1, 1);
  const end = new Date(ty, tm, 1); // 1º dia do mês seguinte ao "até" → limite exclusivo
  return { dueFrom: start.toISOString(), dueTo: end.toISOString() };
}

/** Ordered month buckets across an inclusive 'YYYY-MM' range. */
export function monthBuckets(fromYM: string, toYM: string): { year: number; month: number }[] {
  const [fy, fm] = fromYM.split('-').map(Number) as [number, number];
  const [ty, tm] = toYM.split('-').map(Number) as [number, number];
  const out: { year: number; month: number }[] = [];
  let d = new Date(fy, fm - 1, 1);
  const stop = new Date(ty, tm - 1, 1);
  while (d <= stop) {
    out.push({ year: d.getFullYear(), month: d.getMonth() });
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  }
  return out;
}

/** Query window ({ dueFrom, dueTo }) for a calendar month, local midnights as UTC instants. */
export function monthWindow(reference: Date, offset = 0): DateWindow {
  const start = new Date(reference.getFullYear(), reference.getMonth() + offset, 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + offset + 1, 1);
  return { dueFrom: start.toISOString(), dueTo: end.toISOString() };
}

export function startOfMonth(reference: Date, offset = 0): string {
  return new Date(reference.getFullYear(), reference.getMonth() + offset, 1).toISOString();
}

/** Human label for a calendar month, e.g. 'Janeiro 2026'. */
export function monthLabel(reference: Date, offset = 0): string {
  const d = new Date(reference.getFullYear(), reference.getMonth() + offset, 1);
  return `${FULL_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** 'YYYY-MM-DD' → ISO instant at UTC midnight; '' → ''. */
export function dateToIso(date: string): string {
  return date ? `${date}T00:00:00.000Z` : '';
}

/** ISO instant → 'YYYY-MM-DD' for a native date input. */
export function isoToDate(iso: string): string {
  return iso ? iso.slice(0, 10) : '';
}

export function todayIso(): string {
  return dateToIso(new Date().toISOString().slice(0, 10));
}

/** Formats an ISO instant as a pt-BR date (day/month/year). */
export function day(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}
