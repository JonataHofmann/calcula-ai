/**
 * Pure money helpers — integer cents only, never float arithmetic (regra 1).
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
