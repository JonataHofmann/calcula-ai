import { addMonthClamped } from './recurrence';

/** Parses a "YYYY-MM" reference month into a UTC Date at day 1 of that month. */
function monthStart(referenceMonth: string): Date {
  const [year, month] = referenceMonth.split('-').map(Number);
  return new Date(Date.UTC(year as number, (month as number) - 1, 1));
}

/** A UTC date at `day` of (year, month), clamping to the month's last day for short months. */
function clampDay(year: number, month: number, day: number): Date {
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const clamped = Math.min(Math.max(day, 1), lastDay);
  return new Date(Date.UTC(year, month, clamped));
}

/**
 * Invoice due date for an imported statement: the card's `dueDay` within the
 * reference month, clamped to the month's last day for short months (FR-016 / R8).
 */
export function invoiceDueDate(referenceMonth: string, dueDay: number): Date {
  const start = monthStart(referenceMonth);
  return clampDay(start.getUTCFullYear(), start.getUTCMonth(), dueDay);
}

/**
 * Invoice due date for a manual card purchase, from the card's billing cycle (UTC):
 * a purchase on/before `closingDay` lands in the invoice that closes this month, else the
 * next; the due date is the next `dueDay` after that closing — same month if `dueDay > closingDay`,
 * otherwise the following month. Day clamped to the due month's last day.
 *
 * Ex.: closing=25/due=5 → buy 20/Jan ⇒ due 05/Feb; buy 26/Jan ⇒ due 05/Mar.
 *      closing=5/due=15 → buy 03/Jan ⇒ due 15/Jan; buy 10/Jan ⇒ due 15/Feb.
 */
export function invoiceDueDateForPurchase(
  purchase: Date,
  closingDay: number,
  dueDay: number,
): Date {
  const year = purchase.getUTCFullYear();
  const month = purchase.getUTCMonth();
  const day = purchase.getUTCDate();
  const closingMonth = day <= closingDay ? month : month + 1;
  const dueMonth = dueDay > closingDay ? closingMonth : closingMonth + 1;
  return clampDay(year, dueMonth, dueDay);
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
