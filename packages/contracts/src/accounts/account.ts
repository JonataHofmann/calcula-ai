import { z } from 'zod';
import { bankSchema } from '../reference/bank.js';
import { iconKeySchema } from '../reference/icon.js';
import { colorTokenSchema } from '../reference/color.js';

/** Account as exposed by the BFF (no userId — FR-023). */
export const accountSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  bankId: bankSchema,
  icon: iconKeySchema,
  color: colorTokenSchema,
});

export type AccountDto = z.infer<typeof accountSchema>;

export const createAccountInput = z.object({
  name: z.string().trim().min(1, 'Nome é obrigatório').max(60),
  bankId: bankSchema,
  icon: iconKeySchema,
  color: colorTokenSchema,
});

export type CreateAccountInput = z.infer<typeof createAccountInput>;

export const updateAccountInput = createAccountInput.partial();

export type UpdateAccountInput = z.infer<typeof updateAccountInput>;
