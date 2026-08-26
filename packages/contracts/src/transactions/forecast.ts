import { z } from 'zod';
import { moneyAmountSchema } from '../common/money.js';

export const forecastQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}$/),
  months: z.preprocess(
    (v) => (typeof v === 'string' ? Number(v) : v),
    z.union([
      z.literal(1),
      z.literal(3),
      z.literal(6),
      z.literal(12),
      z.literal(24),
      z.literal(36),
    ]),
  ),
});
export type ForecastQuery = z.infer<typeof forecastQuerySchema>;

export const forecastRowSchema = z.object({
  key: z.string(),
  description: z.string(),
  recurrence: z.enum(['installment', 'fixed']),
  installmentCount: z.number().int().positive().nullable(),
  /** Origin of the commitment: which account or card it is charged to. */
  originKind: z.enum(['account', 'card']).nullable(),
  originId: z.string().uuid().nullable(),
  originName: z.string().nullable(),
  cells: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      amount: moneyAmountSchema.nullable(),
    }),
  ),
});
export type ForecastRow = z.infer<typeof forecastRowSchema>;

export const forecastResponseSchema = z.object({
  months: z.array(z.string().regex(/^\d{4}-\d{2}$/)),
  rows: z.array(forecastRowSchema),
  totals: z.array(
    z.object({
      month: z.string().regex(/^\d{4}-\d{2}$/),
      amount: moneyAmountSchema,
    }),
  ),
});
export type ForecastResponse = z.infer<typeof forecastResponseSchema>;
