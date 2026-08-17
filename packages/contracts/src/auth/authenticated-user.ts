import { z } from 'zod';

export const authenticatedUserSchema = z.object({
  id: z.string(),
  keycloakUserId: z.string(),
  roles: z.array(z.string()),
});

export type AuthenticatedUser = z.infer<typeof authenticatedUserSchema>;
