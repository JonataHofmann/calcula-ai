/**
 * Pure recurrence/money helpers. No framework, no float arithmetic for money
 * (integer cents only — regra 1 / R2). Dates are UTC instants (R4).
 */

/** Decimal money string (e.g. "100.00") -> integer cents. */
export function toCents(amount: string): number {
  const normalized = amount.trim();
  const negative = normalized.startsWith('-');
  const digits = negative ? normalized.slice(1) : normalized;
  const [whole, fraction = ''] = digits.split('.');
  const cents = Number(whole) * 100 + Number((fraction + '00').slice(0, 2));
  return negative ? -cents : cents;
}

/** Integer cents -> decimal money string with two fraction digits. */
export function fromCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${fraction}`;
}

/**
 * Split a total (in cents) into `count` installments; the LAST parcel absorbs
 * the remainder so the sum always equals the total (R2). Returns money strings.
 */
export function splitInstallments(totalCents: number, count: number): string[] {
  if (count < 1) throw new Error('installment count must be >= 1');
  const base = Math.floor(totalCents / count);
  const parcels: string[] = [];
  for (let i = 0; i < count - 1; i += 1) parcels.push(fromCents(base));
  parcels.push(fromCents(totalCents - base * (count - 1)));
  return parcels;
}

/**
 * Add `n` months to a UTC date, preserving the day-of-month; if the target
 * month has no such day (e.g. Jan 31 -> Feb), clamp to the month's last day (R8).
 */
export function addMonthClamped(date: Date, n: number): Date {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(
    Date.UTC(
      year,
      month + n,
      1,
      date.getUTCHours(),
      date.getUTCMinutes(),
      date.getUTCSeconds(),
      date.getUTCMilliseconds(),
    ),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target;
}

/**
 * Next monthly occurrence of a fixed transaction: `dueDate + 1 month` (clamped),
 * unless it would pass `endDate`, in which case returns null (FR-014 / R10).
 */
export function nextOccurrence(dueDate: Date, endDate?: Date | null): Date | null {
  const next = addMonthClamped(dueDate, 1);
  if (endDate && next.getTime() > endDate.getTime()) return null;
  return next;
}
