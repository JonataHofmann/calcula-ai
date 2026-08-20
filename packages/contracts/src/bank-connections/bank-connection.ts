import { z } from 'zod';
import { moneyAmountSchema } from '../common/money.js';

export const bankConnectionStatusSchema = z.enum(['active', 'needs_attention', 'disconnected']);
export type BankConnectionStatus = z.infer<typeof bankConnectionStatusSchema>;

export const linkedAccountTypeSchema = z.enum(['CHECKING_ACCOUNT', 'SAVINGS_ACCOUNT']);
export type LinkedAccountType = z.infer<typeof linkedAccountTypeSchema>;

/** Linked Account as exposed by the banking-ms API — distinct entity from `Account` (R8). */
export const linkedAccountSchema = z.object({
  id: z.string().uuid(),
  displayName: z.string().min(1),
  type: linkedAccountTypeSchema,
  balance: moneyAmountSchema,
  currency: z.literal('BRL'),
});
export type LinkedAccountDto = z.infer<typeof linkedAccountSchema>;

/** Linked Credit Card as exposed by the banking-ms API — distinct entity from `CreditCard` (R8). */
export const linkedCreditCardSchema = z.object({
  id: z.string().uuid(),
  brand: z.string().min(1).nullable(),
  lastDigits: z
    .string()
    .regex(/^\d{4}$/, 'Informe os 4 últimos dígitos')
    .nullable(),
  currentBalance: moneyAmountSchema,
  creditLimit: moneyAmountSchema.nullable(),
});
export type LinkedCreditCardDto = z.infer<typeof linkedCreditCardSchema>;

export const bankConnectionSchema = z.object({
  id: z.string().uuid(),
  institutionName: z.string().min(1),
  status: bankConnectionStatusSchema,
  lastSyncedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  accounts: z.array(linkedAccountSchema),
  creditCards: z.array(linkedCreditCardSchema),
  transactionsTotal: z.number().int().nonnegative(),
  transactionsErrored: z.number().int().nonnegative(),
});
export type BankConnectionDto = z.infer<typeof bankConnectionSchema>;

export const bankConnectionCreateInput = z.object({
  pluggyItemId: z.string().min(1),
});
export type BankConnectionCreateInput = z.infer<typeof bankConnectionCreateInput>;

export const refreshBankConnectionInput = z.object({
  forceFullSync: z.boolean().optional().default(false),
});
export type RefreshBankConnectionInput = z.infer<typeof refreshBankConnectionInput>;

export const retryConnectionImportsResponse = z.object({
  retried: z.number().int().nonnegative(),
  succeeded: z.number().int().nonnegative(),
  stillFailing: z.number().int().nonnegative(),
});
export type RetryConnectionImportsResponse = z.infer<typeof retryConnectionImportsResponse>;
