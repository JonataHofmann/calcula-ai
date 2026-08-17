import { z } from 'zod';

export const sessionUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  roles: z.array(z.string()),
});

export type SessionUser = z.infer<typeof sessionUserSchema>;
