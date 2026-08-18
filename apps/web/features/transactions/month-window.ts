/** Month boundaries computed in the user's local timezone, emitted as UTC instants (R4/R5). */
export interface MonthWindow {
  /** Inclusive start of the month (local midnight) as a UTC ISO instant. */
  dueFrom: string;
  /** Exclusive start of the next month (local midnight) as a UTC ISO instant. */
  dueTo: string;
}

/** `offset` shifts by whole months from the current month (0 = current, -1 = previous). */
export function monthWindow(reference: Date, offset = 0): MonthWindow {
  const start = new Date(reference.getFullYear(), reference.getMonth() + offset, 1);
  const end = new Date(reference.getFullYear(), reference.getMonth() + offset + 1, 1);
  return { dueFrom: start.toISOString(), dueTo: end.toISOString() };
}

/** Start of the current month (local) as a UTC instant — the `before` bound for overdue rows. */
export function startOfMonth(reference: Date, offset = 0): string {
  return new Date(reference.getFullYear(), reference.getMonth() + offset, 1).toISOString();
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

/** Human label like "Janeiro 2026" for a month offset from the reference. */
export function monthLabel(reference: Date, offset = 0): string {
  const d = new Date(reference.getFullYear(), reference.getMonth() + offset, 1);
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
