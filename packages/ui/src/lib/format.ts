const DECIMAL_RE = /^(-)?(\d+)(?:\.(\d{1,2}))?$/;

function parseDecimal(value: string): { negative: boolean; units: bigint; cents: number } {
  const match = DECIMAL_RE.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid decimal string: "${value}"`);
  }
  const sign = match[1];
  const integer = match[2] ?? '0';
  const fraction = match[3] ?? '';
  return {
    negative: sign === '-',
    units: BigInt(integer),
    cents: Number(fraction.padEnd(2, '0')),
  };
}

const intFormatter = new Intl.NumberFormat('pt-BR');

export function formatBRL(value: string): string {
  const { negative, units, cents } = parseDecimal(value);
  const grouped = intFormatter.format(units);
  const centsPart = String(cents).padStart(2, '0');
  return `${negative ? '-' : ''}R$ ${grouped},${centsPart}`;
}

const PERCENT_RE = /^(-)?(\d+)(?:\.(\d+))?$/;

export function formatPercent(value: string, signed = false): string {
  const match = PERCENT_RE.exec(value.trim());
  if (!match) {
    throw new Error(`Invalid percent string: "${value}"`);
  }
  const sign = match[1];
  const integer = match[2] ?? '0';
  const fraction = match[3];
  const negative = sign === '-';
  const grouped = intFormatter.format(BigInt(integer));
  const body = fraction ? `${grouped},${fraction}` : grouped;
  if (negative) {
    return `-${body}%`;
  }
  return `${signed ? '+' : ''}${body}%`;
}
