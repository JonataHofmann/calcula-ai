import { z } from 'zod';

export const currencyCodeSchema = z.enum(['BRL']);
export type CurrencyCode = z.infer<typeof currencyCodeSchema>;

export const moneyAmountSchema = z
  .string()
  .regex(/^-?\d+\.\d{2}$/, 'Amount must be a decimal string with two fraction digits');

export const moneySchema = z.object({
  amount: moneyAmountSchema,
  currency: currencyCodeSchema,
});

export type MoneyDto = z.infer<typeof moneySchema>;
