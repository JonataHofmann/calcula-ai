import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { loadEnv } from '@finance/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { SessionEntity } from './session/session.entity';
import { SESSION_STORE } from './session/session.store';
import { SESSION_SECRET_TOKEN, TypeormSessionStore } from './session/typeorm-session.store';

function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required env var for BFF auth: ${name}`);
  }
  return value;
}

@Module({
  imports: [TypeOrmModule.forFeature([SessionEntity])],
  controllers: [AuthController],
  providers: [
    {
      provide: SESSION_SECRET_TOKEN,
      useFactory: () => requireEnv('SESSION_SECRET', loadEnv().SESSION_SECRET),
    },
    {
      provide: AuthService,
      useFactory: () => {
        const env = loadEnv();
        return new AuthService({
          keycloakUrl: requireEnv('KEYCLOAK_URL', env.KEYCLOAK_URL),
          realm: requireEnv('KEYCLOAK_REALM', env.KEYCLOAK_REALM),
          clientId: requireEnv('KEYCLOAK_CLIENT_ID', env.KEYCLOAK_CLIENT_ID),
          clientSecret: requireEnv('KEYCLOAK_CLIENT_SECRET', env.KEYCLOAK_CLIENT_SECRET),
          bffPublicUrl: requireEnv('BFF_PUBLIC_URL', env.BFF_PUBLIC_URL),
          webUrl: requireEnv('WEB_URL', env.WEB_URL),
        });
      },
    },
    { provide: SESSION_STORE, useClass: TypeormSessionStore },
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
  exports: [SESSION_STORE, AuthService],
})
export class AuthModule {}
