import { z } from 'zod';
import { brandSchema } from '../reference/brand.js';
import { moneyAmountSchema } from '../common/money.js';

const dayOfMonth = z.number().int().min(1).max(31);
const lastDigits = z.string().regex(/^\d{4}$/, 'Informe os 4 últimos dígitos');

/** Non-negative decimal string (money as string — regra 1). */
const limitSchema = moneyAmountSchema.refine(
  (v) => Number(v) >= 0,
  'Limite não pode ser negativo',
);

/** Credit card as exposed by the BFF (no userId — FR-023). */
export const creditCardSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  lastDigits,
  dueDay: dayOfMonth,
  closingDay: dayOfMonth,
  limit: limitSchema,
  brandId: brandSchema,
});

export type CreditCardDto = z.infer<typeof creditCardSchema>;

export const createCreditCardInput = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(60),
  lastDigits,
  dueDay: dayOfMonth,
  closingDay: dayOfMonth,
  limit: limitSchema,
  brandId: brandSchema,
});

export type CreateCreditCardInput = z.infer<typeof createCreditCardInput>;

export const updateCreditCardInput = createCreditCardInput.partial();

export type UpdateCreditCardInput = z.infer<typeof updateCreditCardInput>;
