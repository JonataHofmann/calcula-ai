import { addMonthClamped } from './recurrence';

/** Parses a "YYYY-MM" reference month into a UTC Date at day 1 of that month. */
function monthStart(referenceMonth: string): Date {
  const [year, month] = referenceMonth.split('-').map(Number);
  return new Date(Date.UTC(year as number, (month as number) - 1, 1));
}

/**
 * Invoice due date for an imported statement: the card's `dueDay` within the
 * reference month, clamped to the month's last day for short months (FR-016 / R8).
 */
export function invoiceDueDate(referenceMonth: string, dueDay: number): Date {
  const start = monthStart(referenceMonth);
  const lastDay = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const day = Math.min(Math.max(dueDay, 1), lastDay);
  return new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day));
}

/**
 * Half-open `[start, endExclusive)` window covering the reference month. Used to scope
 * replace/merge to transactions of the card whose `dueDate` falls in that month (FR-019 / R7).
 */
export function referenceMonthWindow(referenceMonth: string): {
  start: Date;
  endExclusive: Date;
} {
  const start = monthStart(referenceMonth);
  return { start, endExclusive: addMonthClamped(start, 1) };
}
