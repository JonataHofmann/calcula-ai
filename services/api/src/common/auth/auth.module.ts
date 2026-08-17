import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { KeycloakTokenVerifier } from '@finance/auth';
import { loadEnv } from '@finance/config';
import { JwtAuthGuard, TOKEN_VERIFIER } from './jwt-auth.guard';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var for API auth: ${name}`);
  }
  return value;
}

@Module({
  providers: [
    {
      provide: TOKEN_VERIFIER,
      useFactory: () => {
        const env = loadEnv();
        return new KeycloakTokenVerifier({
          keycloakUrl: requireEnv('KEYCLOAK_URL', env.KEYCLOAK_URL),
          realm: requireEnv('KEYCLOAK_REALM', env.KEYCLOAK_REALM),
        });
      },
    },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
  exports: [TOKEN_VERIFIER],
})
export class AuthModule {}
