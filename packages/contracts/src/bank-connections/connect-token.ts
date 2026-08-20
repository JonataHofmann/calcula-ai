import { z } from 'zod';

export const connectTokenInput = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('create') }),
  z.object({ mode: z.literal('reauth'), bankConnectionId: z.string().uuid() }),
]);
export type ConnectTokenInput = z.infer<typeof connectTokenInput>;

export const connectTokenResponse = z.object({
  connectToken: z.string().min(1),
  expiresAt: z.string().datetime(),
});
export type ConnectTokenResponse = z.infer<typeof connectTokenResponse>;
