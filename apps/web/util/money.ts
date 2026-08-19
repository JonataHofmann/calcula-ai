/** Parses a money string ("640.35") into integer cents. */
export function toCents(amount: string): number {
  const [int = '0', frac = ''] = amount.split('.');
  const negative = int.startsWith('-');
  const units = BigInt(negative ? int.slice(1) : int);
  const cents = Number(frac.padEnd(2, '0').slice(0, 2));
  const total = Number(units) * 100 + cents;
  return negative ? -total : total;
}

/** Formats integer cents ("64035") as a money string ("640.35") for formatBRL. */
export function centsToMoney(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Formats a decimal-string amount as pt-BR currency. */
export function money(value: string): string {
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
