import { z } from 'zod';
import { moneyAmountSchema } from '../common/money.js';
import { transactionTypeSchema } from './transaction.js';

/**
 * Projection-only estimate (feature: linhas que só existem na previsão). A recurring monthly
 * average the user carries in their head (e.g. "Mercado (média)") that shows in the forecast and
 * counts toward its Total, but is NEVER a real transaction — stored in its own table, never listed
 * on the transactions screen. `amount` is a positive magnitude; `type` carries the direction.
 */

/** Estimate as exposed by the BFF (no userId/timestamps — regra 9). */
export const projectionEstimateSchema = z.object({
  id: z.string().uuid(),
  description: z.string().min(1).max(120),
  amount: moneyAmountSchema.refine((v) => Number(v) > 0, 'Valor deve ser maior que zero'),
  type: transactionTypeSchema,
});
export type ProjectionEstimate = z.infer<typeof projectionEstimateSchema>;

const description = z.string().trim().min(1, 'Descrição é obrigatória').max(120);
const positiveAmount = moneyAmountSchema.refine(
  (v) => Number(v) > 0,
  'Valor deve ser maior que zero',
);

/** Create body (web -> bff -> api). NO userId — it comes from the JWT in the api. */
export const createProjectionEstimateInput = z.object({
  description,
  amount: positiveAmount,
  type: transactionTypeSchema,
});
export type CreateProjectionEstimateInput = z.infer<typeof createProjectionEstimateInput>;

/** Patch body — every field optional; only provided fields change. */
export const updateProjectionEstimateInput = z.object({
  description: description.optional(),
  amount: positiveAmount.optional(),
  type: transactionTypeSchema.optional(),
});
export type UpdateProjectionEstimateInput = z.infer<typeof updateProjectionEstimateInput>;
