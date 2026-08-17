import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.string().url().optional(),
  KEYCLOAK_URL: z.string().url().optional(),
  KEYCLOAK_REALM: z.string().optional(),
  KEYCLOAK_CLIENT_ID: z.string().optional(),
  KEYCLOAK_CLIENT_SECRET: z.string().optional(),
  SESSION_SECRET: z.string().min(32).optional(),
  BFF_PUBLIC_URL: z.string().url().optional(),
  WEB_URL: z.string().url().optional(),
  NEXT_PUBLIC_BFF_URL: z.string().url().optional(),
  AI_ROUTER_URL: z.string().url().optional(),
  AI_ROUTER_API_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment variables: ${issues}`);
  }
  return result.data;
}
