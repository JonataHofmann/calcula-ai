import { z } from 'zod';
import { moneyAmountSchema } from '../common/money.js';

/** Transaction type. Reuses the same values as category type (expense|income). */
export const transactionTypeSchema = z.enum(['expense', 'income']);
export type TransactionType = z.infer<typeof transactionTypeSchema>;

/** Recurrence pattern. Default `single`. */
export const recurrenceSchema = z
  .enum(['single', 'fixed', 'installment'])
  .default('single');
export type Recurrence = z.infer<typeof recurrenceSchema>;

/** Lifecycle status. Default `pending`. */
export const transactionStatusSchema = z
  .enum(['pending', 'paid'])
  .default('pending');
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;

/** Group operation scope (edit/delete a grouped occurrence). */
export const groupScopeSchema = z.enum(['one', 'future', 'all']);
export type GroupScope = z.infer<typeof groupScopeSchema>;

/** Origin of the transaction. `synced` = bank connection (R7); `imported` = credit-card invoice import (008). Default `manual`. */
export const transactionSourceSchema = z
  .enum(['manual', 'synced', 'imported'])
  .default('manual');
export type TransactionSource = z.infer<typeof transactionSourceSchema>;

/**
 * Transaction as exposed by the BFF (no `userId`/`createdAt`/`updatedAt` — regra 9).
 * Money values are decimal strings (`moneyAmountSchema`), never numbers.
 * Dates are ISO instants (UTC — R4).
 */
export const transactionSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(120),
  dueDate: z.string().datetime(),
  /** Card lines: real purchase date. `dueDate` is the invoice due date derived from it. Null for account rows. */
  purchaseDate: z.string().datetime().nullable(),
  amount: moneyAmountSchema,
  effectiveAmount: moneyAmountSchema.nullable(),
  recurrence: z.enum(['single', 'fixed', 'installment']),
  effectiveDate: z.string().datetime().nullable(),
  type: transactionTypeSchema,
  notes: z.string().nullable(),
  status: z.enum(['pending', 'paid']),
  endDate: z.string().datetime().nullable(),
  installmentCount: z.number().int().nullable(),
  installmentNumber: z.number().int().nullable(),
  groupId: z.string().uuid().nullable(),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid().nullable(),
  creditCardId: z.string().uuid().nullable(),
  source: transactionSourceSchema,
  externalId: z.string().uuid().nullable(),
  /**
   * Cash-basis listing flags (only set by the monthly `list` endpoint):
   * `logical` = virtual read-only row shown in the month the transaction was
   * effectuated (its due date falls in another month); `settledElsewhere` = a
   * real row shown in its due month but paid in another month, so it is kept
   * visible yet excluded from this month's balance (regra: sem contagem dupla).
   */
  logical: z.boolean().optional(),
  settledElsewhere: z.boolean().optional(),
});

export type TransactionDto = z.infer<typeof transactionSchema>;

/** Positive decimal-string money (value must be > 0 — R2/R7). */
const positiveMoney = moneyAmountSchema.refine(
  (v) => Number(v) > 0,
  'Valor deve ser maior que zero',
);

const description = z.string().trim().min(1, 'Descrição é obrigatória').max(120);
const notes = z.string().trim().max(2000).nullish();

/** Fields shared by every create variant. Origin (account/card) validated by superRefine. */
const createBase = {
  type: transactionTypeSchema,
  description,
  dueDate: z.string().datetime(),
  /** Card only: real purchase date. Server derives `dueDate` (invoice due) from the card cycle. */
  purchaseDate: z.string().datetime().optional(),
  categoryId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  creditCardId: z.string().uuid().optional(),
  notes,
};

const createSingle = z.object({
  recurrence: z.literal('single'),
  amount: positiveMoney,
  /** Create the row already effectuated (paid). Only valid for `single`. */
  paid: z.boolean().optional(),
  /** Effective date when `paid`. Absent → server assumes the due date. */
  effectiveDate: z.string().datetime().optional(),
  ...createBase,
});

const createFixed = z.object({
  recurrence: z.literal('fixed'),
  amount: positiveMoney,
  endDate: z.string().datetime().nullish(),
  ...createBase,
});

const createInstallment = z.object({
  recurrence: z.literal('installment'),
  installmentCount: z.number().int().min(1, 'Mínimo de 1 parcela'),
  amount: positiveMoney.optional(),
  totalAmount: positiveMoney.optional(),
  ...createBase,
});

/**
 * Origin XOR (R7): expense and income both take exactly one of account/card.
 * installment = exactly one of amount (per-parcel) / totalAmount.
 * fixed = endDate null or >= dueDate.
 */
function refineTransaction(
  data: {
    type: TransactionType;
    accountId?: string;
    creditCardId?: string;
    recurrence: string;
    amount?: string;
    totalAmount?: string;
    dueDate?: string;
    endDate?: string | null;
  },
  ctx: z.RefinementCtx,
): void {
  // Both types: exactly one origin (account XOR card). A card income = estorno/reembolso/
  // pagamento da fatura — reduz a fatura do cartão (agrupada dentro dele).
  const hasAccount = Boolean(data.accountId);
  const hasCard = Boolean(data.creditCardId);
  if (hasAccount === hasCard) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        data.type === 'expense'
          ? 'Despesa exige exatamente uma conta OU um cartão'
          : 'Receita exige exatamente uma conta OU um cartão',
      path: ['accountId'],
    });
  }

  if (data.recurrence === 'installment') {
    const hasAmount = data.amount !== undefined;
    const hasTotal = data.totalAmount !== undefined;
    if (hasAmount === hasTotal) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe valor por parcela OU valor total (apenas um)',
        path: ['totalAmount'],
      });
    }
  }

  if (
    data.recurrence === 'fixed' &&
    data.endDate &&
    data.dueDate &&
    new Date(data.endDate).getTime() < new Date(data.dueDate).getTime()
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Data de término deve ser posterior ao vencimento',
      path: ['endDate'],
    });
  }
}

export const createTransactionInput = z
  .discriminatedUnion('recurrence', [
    createSingle,
    createFixed,
    createInstallment,
  ])
  .superRefine(refineTransaction);

export type CreateTransactionInput = z.infer<typeof createTransactionInput>;

/** Editable fields (partial). Never touches status/effectiveDate/effectiveAmount/installmentNumber/groupId. */
export const updateTransactionInput = z
  .object({
    type: transactionTypeSchema,
    description,
    dueDate: z.string().datetime(),
    /** Card only: recompute the invoice `dueDate` from this purchase date + card cycle. */
    purchaseDate: z.string().datetime(),
    amount: positiveMoney,
    notes,
    categoryId: z.string().uuid(),
    accountId: z.string().uuid().nullable(),
    creditCardId: z.string().uuid().nullable(),
    endDate: z.string().datetime().nullable(),
  })
  .partial();

export type UpdateTransactionInput = z.infer<typeof updateTransactionInput>;

/** Effectuate a pending transaction. Defaults (today/predicted amount) computed by the frontend. */
export const effectuateInput = z.object({
  date: z.string().datetime().optional(),
  amount: positiveMoney.optional(),
});

export type EffectuateInput = z.infer<typeof effectuateInput>;

export const transactionSortSchema = z
  .enum(['dueDate', 'amount', 'description', 'status', 'type', 'recurrence'])
  .default('dueDate');
export type TransactionSort = z.infer<typeof transactionSortSchema>;

export const sortOrderSchema = z.enum(['asc', 'desc']).default('asc');
export type SortOrder = z.infer<typeof sortOrderSchema>;

/** Monthly listing query (frontend supplies dueFrom/dueTo for the user's timezone — R4/R5). */
export const listTransactionsQuery = z.object({
  dueFrom: z.string().datetime(),
  dueTo: z.string().datetime(),
  search: z.string().trim().min(1).optional(),
  amount: z.string().trim().min(1).optional(),
  recurrence: z.enum(['single', 'fixed', 'installment']).optional(),
  type: transactionTypeSchema.optional(),
  categoryId: z.string().uuid().optional(),
  accountId: z.string().uuid().optional(),
  creditCardId: z.string().uuid().optional(),
  sort: transactionSortSchema,
  order: sortOrderSchema,
});

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuery>;

/** Overdue grid query: pending & dueDate < before (start of current month — FR-021). */
export const overdueQuery = z.object({
  before: z.string().datetime(),
});

export type OverdueQuery = z.infer<typeof overdueQuery>;

/** Number of transactions linked to an entity (card/account/category) — shown before a cascading delete. */
export const transactionCountResultSchema = z.object({
  count: z.number().int().nonnegative(),
});

export type TransactionCountResult = z.infer<typeof transactionCountResultSchema>;
